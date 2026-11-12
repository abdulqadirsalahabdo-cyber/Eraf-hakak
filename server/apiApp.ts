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
import {
  createAndSendOtp,
  deleteUserConsultation,
  getUserConsultations,
  isValidEmail,
  saveUserConsultation,
  verifyOtpAndLogin,
  verifySessionToken,
  type EmailUserProfile,
} from './authStore.ts';
import type {
  AttachmentPayload,
  ConsultationMeta,
  ContractAuditResult,
  DraftedDocumentResult,
  LearnedLesson,
  SavedConsultation,
} from '../src/types/legal.ts';

export const apiApp = express();
apiApp.use(express.json({ limit: '16mb' }));

const SESSION_COOKIE_NAME = 'e3raf_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function getAuthenticatedUser(req: express.Request): EmailUserProfile | null {
  const token = extractSessionToken(req);
  return verifySessionToken(token);
}

function setSessionCookie(res: express.Response, token: string): void {
  const maxAge = 60 * 60 * 24 * 14;
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  );
}

function clearSessionCookie(res: express.Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function buildDomainFallbackSuggestions(matchedDomain: string): string[] {
  if (matchedDomain.includes('العقوبات') || matchedDomain.includes('الجنح') || matchedDomain.includes('الجنائية')) {
    return [
      'ما هي المستندات والأدلة المطلوبة لتحرير محضر رسمي ناجح الآن؟',
      'صِغ لي مذكرة بلاغ للنيابة العامة بالوقائع وأرقام المواد العقابية',
      'كيف أثبت حقي وأطالب بالتعويض المدني التبعي مع القضية الجنائية؟',
    ];
  }
  if (matchedDomain.includes('جرائم الإنترنت') || matchedDomain.includes('تقنية المعلومات')) {
    return [
      'ما هي الشروط الفنية لتجهيز لقطات الشاشة قبل التوجه لمباحث الإنترنت؟',
      'كيف أتقدم ببلاغ رسمي عبر خط 108 وأحمي حساباتي من الاختراق؟',
      'ما هي العقوبة القانونية للمتهم وإمكانية المطالبة بتعويض مدني؟',
    ];
  }
  if (matchedDomain.includes('الأحوال الشخصية') || matchedDomain.includes('الأسرة')) {
    return [
      'ما هي الأوراق الرسمية المطلوبة لتقديم طلب تسوية في محكمة الأسرة؟',
      'صِغ لي صيغة دعوى أو إنذار رسمي مناسب لحالتي الأسرية الآن',
      'كيف تُقدّر المحكمة النفقة أو تضمن تنفيذ الحكم وبنك ناصر الاجتماعي؟',
    ];
  }
  if (matchedDomain.includes('العمل')) {
    return [
      'احسب لي قيمة التعويض عن الفصل التعسفي ومكافأة نهاية الخدمة بدقة',
      'ما هو الميعاد القانوني الحاسم لتقديم شكوى مكتب العمل دون سقوط حقي؟',
      'صِغ لي شكوى رسمية لمكتب العمل بإثبات الحقوق والمرتبات المتأخرة',
    ];
  }
  if (matchedDomain.includes('الإيجار')) {
    return [
      'كيف أقوم بإيداع الأجرة في خزينة المحكمة بإنذار عرض رسمي صحيح؟',
      'صِغ لي إنذاراً رسمياً على يد محضر لحفظ حقي في عقد الإيجار',
      'ما هي الحالات الحصرية التي يجوز فيها فسخ عقد الإيجار أو الطرد؟',
    ];
  }
  if (matchedDomain.includes('المستهلك')) {
    return [
      'كيف أرفع شكوى رسمية لجهاز حماية المستهلك على رقم 19588 وما هي الأوراق؟',
      'هل يحق لي استرداد المبلغ نقداً بالكامل أم الاستبدال فقط؟',
      'صِغ لي صيغة شكوى رسمية موجهة لجهاز حماية المستهلك بالوقائع',
    ];
  }
  return [
    'صِغ لي إنذاراً رسمياً بالصيغة القانونية المصرية السليمة لهذه المشكلة',
    'جهّز لي قائمة المستندات المطلوبة والجهة المختصة للتحرك الآن',
    'ما هو الميعاد القانوني الحاسم الذي يجب عدم تجاوزه في هذه القضية؟',
  ];
}

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
      ? `\n### قواعد التحقق ومنع الأخطاء المتعلّمة في مجال "${meta.matchedDomain}" فقط (التزم بها بدقة):\n${lessons
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

  return `### التوجيه القانوني الحصري للمسألة الحالية (Strict Legal Context):
**الفرع القانوني الحصري المسموح بالرد فيه الآن:** ${meta.matchedDomain}.
- يُمنع منعاً باتاً الخلط أو ذكر أو استدعاء أي قانون من فرع آخر لا يخص هذه الواقعة (لا تذكر قانون العمل في قضايا التحرش أو الجنايات أو الأسرة، ولا تذكر قانون العقوبات في النزاعات العمالية المحضة إلا إذا وُجدت واقعة جنائية صريحة في سؤال المستخدم).
- اجعل الإجابة علمية، قانونية، صريحة 100%، مركزة ومباشرة على الحل القانوني الفوري لمشكلة المستخدم فقط بدون مقدمات مطوّلة أو تشتت.

### التوجيه النفسي التكيفي للموقف الحالي:
الحالة النفسية المرصودة للمستخدم: ${meta.sentiment.labelAr}.
التوجيه للنبرة: ${meta.sentiment.reassuranceLead}

### النصوص القانونية المصرية الموثقة الحصرية لهذا النطاق:
${articlesContext}
${lessonsContext}
### أرقام الجهات والخطوط الساخنة ذات الصلة المباشرة:
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
        contents: `أنت مستشار قانوني مصري متخصص في "${matchedDomain}" فقط.
بناءً على هذه المشكلة المحددة حصراً:
سؤال المستخدم: ${query.slice(0, 400)}
ملخص الرد القانوني: ${responseText.slice(0, 700)}

اقترح 3 أسئلة متابعة ذكية ومرتبطة ارتباطاً مباشراً وحصرياً بنفس هذه المشكلة وفي نفس مجال "${matchedDomain}" فقط (لا تخرج أبداً إلى أي قانون أو موضوع آخر، وكل سؤال بصيغة طلب عملي مباشر من المستخدم لا يتجاوز 11 كلمة).`,
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
    // Fallback strictly matched to the domain
  }
  return buildDomainFallbackSuggestions(matchedDomain);
}

// Health & Reference Data Endpoints
apiApp.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'e3raf-ha2ak-api', timestamp: new Date().toISOString() });
});

// Popup-Free Email OTP Authentication Endpoints
apiApp.post('/api/auth/send-otp', async (req, res) => {
  const { email = '', displayName = '' } = (req.body ?? {}) as {
    email?: string;
    displayName?: string;
  };

  if (!isValidEmail(email.trim().toLowerCase())) {
    res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
    return;
  }

  try {
    const result = await createAndSendOtp(email, displayName);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق حالياً.';
    const status = msg.includes('الانتظار') ? 429 : 400;
    res.status(status).json({ error: msg });
  }
});

apiApp.post('/api/auth/verify-otp', (req, res) => {
  const { email = '', code = '' } = (req.body ?? {}) as {
    email?: string;
    code?: string;
  };

  if (!isValidEmail(email.trim().toLowerCase()) || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني ورمز التحقق المكوّن من 6 أرقام.' });
    return;
  }

  try {
    const { user, token, consultations } = verifyOtpAndLogin(email, code);
    setSessionCookie(res, token);
    res.json({ user, token, consultations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر التحقق من الرمز.';
    res.status(400).json({ error: msg });
  }
});

apiApp.get('/api/auth/session', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.json({ user: null, consultations: [] });
    return;
  }
  const consultations = getUserConsultations(user.uid);
  res.json({ user, consultations });
});

apiApp.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Authenticated User Consultations Sync Endpoints
apiApp.get('/api/user/consultations', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول بالبريد الإلكتروني أولاً.' });
    return;
  }
  res.json({ consultations: getUserConsultations(user.uid) });
});

apiApp.post('/api/user/consultations', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول بالبريد الإلكتروني أولاً.' });
    return;
  }
  const { consultation } = (req.body ?? {}) as { consultation?: SavedConsultation };
  if (!consultation || !consultation.id) {
    res.status(400).json({ error: 'بيانات الاستشارة غير مكتملة.' });
    return;
  }
  const consultations = saveUserConsultation(user.uid, consultation);
  res.json({ consultations });
});

apiApp.delete('/api/user/consultations/:id', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول بالبريد الإلكتروني أولاً.' });
    return;
  }
  const consultations = deleteUserConsultation(user.uid, req.params.id);
  res.json({ consultations });
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

    let fullText = '';
    const groundingSources: Array<{ title: string; uri: string }> = [];

    if (!slot.shedLoad) {
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
    }

    // Guaranteed local RAG+Sentiment synthesis under peak burst load or if upstream AI models throttle
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

    const suggestions = slot.shedLoad
      ? buildDomainFallbackSuggestions(matchedDomain)
      : await generateProactiveSuggestions(message, fullText, matchedDomain);
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
        suggestions: buildDomainFallbackSuggestions(matchedDomain),
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
