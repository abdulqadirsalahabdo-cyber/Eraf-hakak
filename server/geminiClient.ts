import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { ConsultationMeta, LearnedLesson } from '../src/types/legal.ts';

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const FREE_TEXT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
] as const;

export const FREE_MULTIMODAL_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
] as const;

export function buildModelConfig(
  model: string,
  baseConfig: Record<string, unknown> = {}
): Record<string, unknown> {
  if (model === 'gemini-3.6-flash') {
    return {
      ...baseConfig,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
  }
  return baseConfig;
}

export async function generateWithFallback(
  params: Omit<GenerateContentParameters, 'model'>,
  models: readonly string[] = FREE_TEXT_MODELS,
  timeoutMs = 15000
): Promise<GenerateContentResponse> {
  const ai = getGeminiClient();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const cfg = buildModelConfig(model, (params.config as Record<string, unknown>) ?? {});
      const result = await Promise.race([
        ai.models.generateContent({
          ...params,
          model,
          config: cfg,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('تعذر الاتصال بنماذج الذكاء الاصطناعي حالياً.');
}

/**
 * Guaranteed domain-strict Egyptian legal consultation synthesizer if all upstream AI models
 * experience transient congestion or load-shedding, ensuring 100% uptime and accurate single-domain solutions.
 */
export function buildGroundedEmergencySolution(
  query: string,
  meta: ConsultationMeta,
  lessons: LearnedLesson[]
): string {
  const primaryArticle = meta.retrievedArticles[0];

  const warmLead = meta.sentiment.needsGroundingExercise
    ? 'اهداً الآن وخذ نفساً عميقاً — موقفك محمي تماماً بنصوص القانون المصري، وهذه هي الخطوات القانونية المباشرة لحفظ حقك:'
    : 'إليك الإجابة القانونية العلمية والمباشرة لمشكلتك وفق التشريع المصري الساري:';

  const legalLines = meta.retrievedArticles
    .map(
      (a) =>
        `- **${a.lawName} (${a.lawNumber}) — ${a.articleNumber} (${a.title}):**\n  ${a.plainSummary}${a.prescriptionPeriod ? `\n  *الميعاد القانوني الحاسم:* ${a.prescriptionPeriod}` : ''}`
    )
    .join('\n');

  const lessonsLines =
    lessons.length > 0
      ? `\n### تنبيهات وقائية خاصة بهذا النوع من القضايا:\n${lessons.map((l) => `- ${l.preventionRule}`).join('\n')}\n`
      : '';

  const hotlinesLines = meta.recommendedHotlines
    .map((h) => `- **${h.agency}:** رقم **${h.number}** (${h.description})`)
    .join('\n');

  return `${warmLead}

### ١. التكييف القانوني الصريح للمشكلة
تندرج واقعتك (${query.slice(0, 120)}) حصرياً تحت نطاق **${meta.matchedDomain}**${primaryArticle ? `، وتحكمها **${primaryArticle.articleNumber}** من **${primaryArticle.lawName} (${primaryArticle.lawNumber})**` : ''}.

### ٢. المواد القانونية الحاكمة والعقوبة / الأثر القانوني
${legalLines}

### ٣. خطة التحرك الفورية والمباشرة
١. **توثيق الأدلة الآن:** احتفظ بكل الأدلة المرتبطة بهذه الواقعة تحديداً (محادثات واضحة برقم الهاتف/الرابط، تقارير طبية، عقود، فواتير، أو شهود عيان) دون حذف أي دليل.
٢. **تقديم البلاغ أو الشكوى لدى الجهة المختصة حصراً:**
${hotlinesLines}
٣. **الإجراء القانوني الحاسم:** إثبات الواقعة رسمياً بمحضر أو إنذار رسمي على يد محضر قبل فوات المواعيد المقررة قانوناً.
${lessonsLines}
*(هذه الاستشارة للتوجيه القانوني الدقيق والتوعية، ولا تُغني عن الاستعانة بمحامٍ متخصص لمباشرة الإجراءات القضائية الفعلية)*`;
}

export const BASE_LEGAL_SYSTEM_INSTRUCTION = `أنت "اعرف حقك"، مستشار قانوني مصري متخصص، دقيق علمياً وصارم منهجياً.

### القواعد الصارمة غير القابلة للتفاوض (Strict Legal Context):
1. **منع الخلط بين القوانين منعاً باتاً:**
   - ركّز 100% على الفرع القانوني للمشكلة المعروضة فقط (فمثلاً: قضية تحرش أو اعتداء تُعالج حصراً بقانون العقوبات والإجراءات الجنائية ولا يُذكر فيها قانون العمل أو الأحوال الشخصية؛ وقضية نفقة أو خلع تُعالج حصراً بقانون الأحوال الشخصية؛ وقضية فصل تعسفي تُعالج حصراً بقانون العمل؛ وقضية ابتزاز إلكتروني تُعالج حصراً بقانون مكافحة جرائم تقنية المعلومات والعقوبات).
   - ممنوع التشتت أو فتح مواضيع جانبية لا علاقة لها بسؤال المستخدم.
2. **إجابة علمية قانونية دقيقة وصريحة مباشرة:**
   - **الاحتواء المختصر:** جملة أو جملتان دافئتان ومطمئنتان فقط إذا كان السائل في حالة توتر.
   - **التكييف القانوني الدقيق:** حدد الجريمة أو النزاع القانوني بالاسم القانوني الصحيح في مصر.
   - **النصوص والعقوبات/الحقوق الحاكمة:** اذكر اسم القانون المصري ورقمه ورقم المادة الصحيحة من السياق الموثق والعقوبة المقررة أو الأثر القانوني بدقة دون اختراع مواد.
   - **خطوات التحرك المباشرة:** خطوات عملية مرقمة (من 1 إلى 4) تناسب هذه المشكلة بالذات مع ذكر الجهة المختصة والمستندات المطلوبة والميعاد القانوني الحاسم.
3. **الخصوصية والختام:**
   - اختم بالتنويه المختصر:
"(هذه الاستشارة للتوجيه القانوني الدقيق والتوعية، ولا تُغني عن الاستعانة بمحامٍ متخصص لمباشرة الإجراءات القضائية الفعلية)"`;
