import 'dotenv/config';
import express from 'express';
import { Modality, Type } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import {
  BASE_LEGAL_SYSTEM_INSTRUCTION,
  FREE_MULTIMODAL_MODELS,
  FREE_TEXT_MODELS,
  buildGroundedEmergencySolution,
  buildModelConfig,
  generateWithFallback,
  getGeminiClient,
} from './geminiClient.ts';
import {
  EGYPTIAN_HOTLINES,
  EGYPTIAN_LAW_ARTICLES,
  retrieveRelevantArticles,
} from './legalKnowledgeBase.ts';
import { analyzeArabicSentiment } from './sentimentEngine.ts';
import {
  acquireConsultationSlot,
  getCachedConsultation,
  setCachedConsultation,
} from './cacheAndQueue.ts';
import {
  autoLearnFromSolvedCase,
  getPlatformInsights,
  recordDomainUsage,
  recordFeedbackAndLearn,
  retrieveLearnedLessons,
} from './learningStore.ts';
import type {
  AttachmentPayload,
  ConsultationMeta,
  ContractAuditResult,
  DraftedDocumentResult,
  LearnedLesson,
} from '../src/types/legal.ts';

export const apiApp = express();
apiApp.use(express.json({ limit: '16mb' }));

function buildGroundedPrompt(
  query: string,
  meta: ConsultationMeta,
  lessons: LearnedLesson[],
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  hasAttachment: boolean
): string {
  const articlesContext = meta.retrievedArticles
    .map(
      (a) =>
        `- ${a.lawName} (${a.lawNumber}) — ${a.articleNumber} [${a.title}]:\n  النص الرسمي: "${a.officialText}"\n  الشرح المبسط: ${a.plainSummary}${a.prescriptionPeriod ? `\n  التقادم/المواعيد: ${a.prescriptionPeriod}` : ''}`
    )
    .join('\n\n');

  const lessonsContext =
    lessons.length > 0
      ? `\n### قواعد التحقق ومنع الأخطاء المتعلّمة من حالات واقعية سابقة (التزم بها بدقة):\n${lessons
          .map(
            (l) =>
              `- [${l.type === 'correction' ? 'تصحيح مهم' : 'خبرة متعلّمة'} - ${l.domain}]: ${l.preventionRule}`
          )
          .join('\n')}\n`
      : '';

  const hotlinesContext = meta.recommendedHotlines
    .map((h) => `- ${h.agency}: ${h.number} (${h.description})`)
    .join('\n');

  const historyText =
    history.length > 0
      ? `\n### سياق المحادثة السابقة:\n${history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'المستخدم' : 'المستشار'}: ${m.content}`)
          .join('\n')}\n`
      : '';

  return `### التوجيه النفسي التكيفي للموقف الحالي:
الحالة النفسية المرصودة للمستخدم: ${meta.sentiment.labelAr}.
التوجيه الإلزامي للنبرة: ${meta.sentiment.reassuranceLead}

### النصوص القانونية المصرية الموثقة (RAG Grounding Context):
${articlesContext}
${lessonsContext}
### أرقام الجهات والخطوط الساخنة ذات الصلة:
${hotlinesContext}
${historyText}
### رسالة المستخدم الحالية${hasAttachment ? ' (مرفق معها صورة مستند/عقد للفحص)' : ''}:
${query || 'يرجى فحص المستند المرفق وتحديد أي ثغرات قانونية أو بنود مجحفة وفق القانون المصري.'}`;
}

async function generateProactiveSuggestions(
  query: string,
  responseText: string,
  matchedDomain: string
): Promise<string[]> {
  try {
    const res = await generateWithFallback(
      {
        contents: `بناءً على استشارة المستخدم في مجال "${matchedDomain}":
سؤال المستخدم: ${query.slice(0, 400)}
ملخص الرد القانوني: ${responseText.slice(0, 700)}

اقترح 3 خطوات استباقية عملية وقصيرة جداً (كل اقتراح بصيغة طلب مباشر من المستخدم بصيغة المتكلم لا يتجاوز 10 كلمات، مثل: "صِغ لي إنذاراً رسمياً على يد محضر الآن" أو "اكتب لي قائمة المستندات المطلوبة لقسم الشرطة").`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
      ['gemini-3.5-flash-lite', 'gemini-3.6-flash'],
      6000
    );
    const parsed = JSON.parse((res.text ?? '[]').trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3).map((s) => String(s));
    }
  } catch {
    // Fallback deterministic suggestions
  }
  return [
    'صِغ لي إنذاراً رسمياً بالصيغة القانونية المصرية السليمة',
    'جهّز لي قائمة المستندات والأوراق المطلوبة للتحرك الآن',
    'ما هو الحل الودي الأقل تكلفة قبل اللجوء للمحكمة؟',
  ];
}

// Health & Reference Data Endpoints
apiApp.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'e3raf-ha2ak-api' });
});

apiApp.get('/api/laws', (_req, res) => {
  res.json({ articles: EGYPTIAN_LAW_ARTICLES });
});

apiApp.get('/api/hotlines', (_req, res) => {
  res.json({ hotlines: EGYPTIAN_HOTLINES });
});

apiApp.get('/api/insights', (_req, res) => {
  res.json({ insights: getPlatformInsights() });
});

// Self-Learning Feedback Endpoint
apiApp.post('/api/feedback', (req, res) => {
  const {
    domain = 'استشارة قانونية عامة',
    userQuery = '',
    isHelpful = true,
    correctionNote = '',
  } = req.body as {
    domain?: string;
    userQuery?: string;
    isHelpful?: boolean;
    correctionNote?: string;
  };

  if (!isHelpful && correctionNote.trim().length < 5) {
    res
      .status(400)
      .json({ error: 'يرجى كتابة توضيح مختصر للخطأ أو المعلومة الناقصة لتتعلم المنصة.' });
    return;
  }

  const result = recordFeedbackAndLearn({
    domain,
    userQuery,
    isHelpful,
    correctionNote,
  });

  res.json(result);
});

async function handleConsultStream(req: express.Request, res: express.Response) {
  const {
    message = '',
    history = [],
    attachment = null,
    bypassCache = false,
    useSearch = false,
  } = (req.body ?? {}) as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    attachment?: AttachmentPayload | null;
    bypassCache?: boolean;
    useSearch?: boolean;
  };

  if (!message.trim() && !attachment) {
    res.status(400).json({ error: 'يرجى كتابة استفسارك أو إرفاق صورة المستند أولاً.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const hasHistory = Array.isArray(history) && history.length > 0;
  const hasAttachment = Boolean(attachment?.base64Data);

  if (!bypassCache && !useSearch) {
    const cached = getCachedConsultation(message, hasHistory, hasAttachment);
    if (cached) {
      sendEvent('meta', cached.meta);
      const words = cached.text.split(/(\s+)/);
      let buffer = '';
      for (let i = 0; i < words.length; i++) {
        buffer += words[i];
        if (i % 10 === 0 || i === words.length - 1) {
          sendEvent('chunk', { text: buffer });
          buffer = '';
        }
      }
      sendEvent('suggestions', { suggestions: cached.suggestions });
      sendEvent('done', {});
      res.end();
      return;
    }
  }

  const slot = await acquireConsultationSlot();

  try {
    const sentiment = analyzeArabicSentiment(message);
    const { articles, matchedDomain, hotlines } = retrieveRelevantArticles(message, 4);
    const lessons = retrieveLearnedLessons(message, matchedDomain, 3);
    recordDomainUsage(matchedDomain);

    const meta: ConsultationMeta = {
      sentiment,
      matchedDomain,
      retrievedArticles: articles,
      recommendedHotlines: hotlines,
      appliedLessonsCount: lessons.length,
      fromCache: false,
      queuePosition: slot.queuePosition,
    };

    sendEvent('meta', meta);

    const promptText = buildGroundedPrompt(message, meta, lessons, history, hasAttachment);
    const contents =
      hasAttachment && attachment
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: attachment.mimeType,
                  data: attachment.base64Data,
                },
              },
              { text: promptText },
            ],
          }
        : promptText;

    const candidateModels =
      hasAttachment || useSearch ? FREE_MULTIMODAL_MODELS : FREE_TEXT_MODELS;

    let fullText = '';
    const groundingSources: Array<{ title: string; uri: string }> = [];

    for (const model of candidateModels) {
      try {
        const ai = getGeminiClient();
        const baseConfig: Record<string, unknown> = {
          systemInstruction: BASE_LEGAL_SYSTEM_INSTRUCTION,
        };
        if (useSearch && (model === 'gemini-3.6-flash' || model === 'gemini-3.5-flash')) {
          baseConfig.tools = [{ googleSearch: {} }];
        }

        const streamPromise = ai.models.generateContentStream({
          model,
          contents,
          config: buildModelConfig(model, baseConfig),
        });

        const stream = await Promise.race([
          streamPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout connecting to ${model}`)), 10000)
          ),
        ]);

        const iterator = stream[Symbol.asyncIterator]();
        let gotAnyText = false;

        while (true) {
          const nextStep = await Promise.race([
            iterator.next(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout waiting for chunk from ${model}`)),
                gotAnyText ? 12000 : 10000
              )
            ),
          ]);

          if (nextStep.done) break;
          const c = nextStep.value as GenerateContentResponse;
          const chunkText = c.text ?? '';
          if (chunkText) {
            gotAnyText = true;
            fullText += chunkText;
            sendEvent('chunk', { text: chunkText });
          }

          const chunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const g of chunks) {
              if (g.web?.uri && !groundingSources.some((s) => s.uri === g.web?.uri)) {
                groundingSources.push({
                  title: g.web.title || g.web.uri,
                  uri: g.web.uri,
                });
              }
            }
          }
        }

        if (gotAnyText) {
          break;
        }
      } catch {
        if (fullText.length > 40) break;
      }
    }

    // Guaranteed local RAG+Sentiment synthesis if all upstream AI models fail or throttle
    if (!fullText.trim()) {
      fullText = buildGroundedEmergencySolution(message, meta, lessons);
      const segments = fullText.split(/(\s+)/);
      let chunkBuf = '';
      for (let i = 0; i < segments.length; i++) {
        chunkBuf += segments[i];
        if (i % 12 === 0 || i === segments.length - 1) {
          sendEvent('chunk', { text: chunkBuf });
          chunkBuf = '';
        }
      }
    }

    if (groundingSources.length > 0) {
      const linksMarkdown = `\n\n### مصادر وروابط رسمية داعمة:\n${groundingSources
        .slice(0, 4)
        .map((s) => `- [${s.title}](${s.uri})`)
        .join('\n')}`;
      fullText += linksMarkdown;
      sendEvent('chunk', { text: linksMarkdown });
    }

    if (fullText.length > 100 && message.trim().length > 10) {
      autoLearnFromSolvedCase({
        domain: matchedDomain,
        userQuery: message,
        assistantSummary: fullText,
      });
    }

    const suggestions = await generateProactiveSuggestions(message, fullText, matchedDomain);
    sendEvent('suggestions', { suggestions });

    if (!hasHistory && !hasAttachment && fullText.length > 80) {
      setCachedConsultation(message, fullText, suggestions, meta);
    }

    sendEvent('done', {});
    res.end();
  } catch (err) {
    // Even if an unexpected error occurs mid-request, synthesize emergency solution instead of dropping the citizen
    try {
      const sentiment = analyzeArabicSentiment(message);
      const { articles, matchedDomain, hotlines } = retrieveRelevantArticles(message, 4);
      const lessons = retrieveLearnedLessons(message, matchedDomain, 3);
      const fallbackMeta: ConsultationMeta = {
        sentiment,
        matchedDomain,
        retrievedArticles: articles,
        recommendedHotlines: hotlines,
        appliedLessonsCount: lessons.length,
        fromCache: false,
        queuePosition: 0,
      };
      sendEvent('meta', fallbackMeta);
      const fallbackText = buildGroundedEmergencySolution(message, fallbackMeta, lessons);
      sendEvent('chunk', { text: fallbackText });
      sendEvent('suggestions', {
        suggestions: [
          'صِغ لي إنذاراً رسمياً بالصيغة القانونية المصرية السليمة',
          'جهّز لي قائمة المستندات والأوراق المطلوبة للتحرك الآن',
        ],
      });
      sendEvent('done', {});
      res.end();
    } catch {
      const errMsg =
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة الاستشارة.';
      sendEvent('error', { error: errMsg });
      res.end();
    }
  } finally {
    slot.release();
  }
}

// Primary streaming route + resilient alias routes
apiApp.post('/api/consult/stream', handleConsultStream);
apiApp.post('/api/consult', handleConsultStream);
apiApp.post('/api/chat', handleConsultStream);

// Legal Notice & Complaint Drafter
apiApp.post('/api/draft-document', async (req, res) => {
  const {
    templateType = 'إنذار رسمي على يد محضر',
    senderRole = '',
    recipientName = '',
    facts = '',
    demands = '',
  } = (req.body ?? {}) as {
    templateType?: string;
    senderRole?: string;
    recipientName?: string;
    facts?: string;
    demands?: string;
  };

  if (!facts.trim() || !demands.trim()) {
    res
      .status(400)
      .json({ error: 'يرجى كتابة ملخص الوقائع وطلباتك لصياغة المحرر القانوني بدقة.' });
    return;
  }

  try {
    const { articles } = retrieveRelevantArticles(`${templateType} ${facts} ${demands}`, 3);
    const articlesRef = articles
      .map((a) => `${a.lawName} (${a.lawNumber}) - ${a.articleNumber}: ${a.plainSummary}`)
      .join('\n');

    const response = await generateWithFallback(
      {
        contents: `صِغ محرراً قانونياً رسمياً سليماً باللغة العربية المصرية المعتمدة في المحاكم والجهات الرسمية في مصر.
نوع المحرر: ${templateType}
صفة مُقدّم الطلب / المنذر: ${senderRole || '[اسمك وصفتك]'}
الجهة أو الشخص الموجّه إليه: ${recipientName || '[الاسم أو الجهة المختصة]'}
الوقائع: ${facts}
الطلبات: ${demands}

النصوص القانونية المصرية الاسترشادية:
${articlesRef}`,
        config: {
          systemInstruction:
            'أنت محرر صياغات قانونية مصري محترف. اكتب نص المحرر كاملاً بأسلوب رسمي رصين ومباشر يتضمن الديباجة والوقائع والأسانيد القانونية المصرية والطلبات الختامية مع ترك أماكن واضحة بين أقواس مربعة [مثل: الاسم، العنوان، التاريخ] للبيانات الشخصية التي يملؤها المواطن بنفسه حفاظاً على خصوصيته.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentTitle: { type: Type.STRING },
              targetAuthority: { type: Type.STRING },
              legalBasis: { type: Type.STRING },
              fullText: { type: Type.STRING },
              requiredAttachments: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              filingSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      },
      FREE_TEXT_MODELS,
      16000
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as DraftedDocumentResult;
    res.json({ draft: parsed });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'تعذر صياغة المستند حالياً.';
    res.status(500).json({ error: errMsg });
  }
});

// Multimodal AI Contract & Document Scanner
apiApp.post('/api/scan-contract', async (req, res) => {
  const {
    imageBase64,
    mimeType,
    documentType = 'عقد أو مستند قانوني',
    notes = '',
  } = (req.body ?? {}) as {
    imageBase64?: string;
    mimeType?: string;
    documentType?: string;
    notes?: string;
  };

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: 'يرجى إرفاق صورة واضحة للعقد أو المستند المراد فحصه.' });
    return;
  }

  try {
    const response = await generateWithFallback(
      {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `افحص هذه الوثيقة المصنفة كـ "${documentType}" وفق أحكام القانون المصري الساري.
ملاحظات إضافية من المستخدم: ${notes || 'لا توجد'}.

استخرج البنود الحساسة أو الثغرات القانونية أو الشروط المجحفة أو الباطلة قانوناً، مع توضيح التعديل المقترح لحماية الموقّع.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت خبير فحص عقود ومحررات قانونية في جمهورية مصر العربية. حلل المستند بدقة متناهية وفق القانون المدني وقانون العمل وقانون العقوبات المصري دون اختلاق نصوص غير موجودة في الصورة. إذا كانت الصورة غير واضحة أو غير مقروءة، وضّح ذلك بأمانة في الملخص.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentType: { type: Type.STRING },
              overallRisk: { type: Type.STRING },
              overallRiskAr: { type: Type.STRING },
              executiveSummary: { type: Type.STRING },
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    clauseTitle: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    severityAr: { type: Type.STRING },
                    legalBasis: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    recommendedEdit: { type: Type.STRING },
                  },
                },
              },
              missingProtections: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              nextSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      },
      FREE_MULTIMODAL_MODELS,
      20000
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as ContractAuditResult;
    res.json({ audit: parsed });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : 'تعذر فحص المستند حالياً، يرجى المحاولة بصورة أوضح.';
    res.status(500).json({ error: errMsg });
  }
});

// Voice-to-Text Transcription
apiApp.post('/api/transcribe', async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm' } = (req.body ?? {}) as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64) {
    res.status(400).json({ error: 'لم يتم استلام أي تسجيل صوتي.' });
    return;
  }

  try {
    const response = await generateWithFallback(
      {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'فرّغ هذا التسجيل الصوتي باللغة العربية / اللهجة المصرية بدقة تامة دون إضافة تعليقات أو مقدمات، وأعد النص المفرغ فقط.',
            },
          ],
        },
      },
      ['gemini-3.5-transcribe', 'gemini-3.6-flash', 'gemini-3.5-flash'],
      15000
    );

    res.json({ transcript: (response.text ?? '').trim() });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'تعذر تفريغ التسجيل الصوتي.';
    res.status(500).json({ error: errMsg });
  }
});

// Calm Legal Consultation Text-to-Speech
apiApp.post('/api/tts', async (req, res) => {
  const { text } = (req.body ?? {}) as { text?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'لا يوجد نص للقراءة الصوتية.' });
    return;
  }

  const cleanText = text
    .replace(/[#*_`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2200);

  try {
    const ai = getGeminiClient();
    let base64Audio: string | undefined;

    for (const ttsModel of ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']) {
      try {
        const response = await ai.models.generateContent({
          model: ttsModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: 'Warm, calm, reassuring, and clear Arabic legal advisor voice',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) break;
      } catch {
        // Try fallback TTS model
      }
    }

    if (!base64Audio) {
      res.status(500).json({ error: 'لم يتم توليد الصوت بنجاح حالياً.' });
      return;
    }

    res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'تعذر تشغيل القراءة الصوتية حالياً.';
    res.status(500).json({ error: errMsg });
  }
});

// Clean JSON 404 for unknown /api/* paths instead of HTML 404
apiApp.use('/api', (_req, res) => {
  res.status(404).json({ error: 'المسار البرمجي المطلوب غير موجود.' });
});
