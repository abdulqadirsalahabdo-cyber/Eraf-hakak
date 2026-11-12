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
 * Guaranteed comprehensive Egyptian legal consultation synthesizer if all upstream AI models
 * experience transient congestion, ensuring the citizen ALWAYS receives clear, actionable solutions.
 */
export function buildGroundedEmergencySolution(
  query: string,
  meta: ConsultationMeta,
  lessons: LearnedLesson[]
): string {
  const primaryArticle = meta.retrievedArticles[0];
  const secondaryArticles = meta.retrievedArticles.slice(1, 3);

  const warmLead = meta.sentiment.needsGroundingExercise
    ? 'اهداً وتنفس بعمق الآن — أنت لست وحدك، والقانون المصري يقف بجانبك تماماً لحماية حقك ورد الأذى عنك.'
    : 'أهلاً بك في «اعرف حقك» — إليك الإجابة الصريحة والحل القانوني والعملي الشامل لموقفك وفق التشريع المصري الساري:';

  const legalLines = meta.retrievedArticles
    .map(
      (a) =>
        `- **${a.lawName} (${a.lawNumber}) — ${a.articleNumber} (${a.title}):**\n  ${a.plainSummary}${a.prescriptionPeriod ? `\n  *تنبيه الميعاد:* ${a.prescriptionPeriod}` : ''}`
    )
    .join('\n');

  const lessonsLines =
    lessons.length > 0
      ? `\n### تنبيهات وقائية مهمة من حالات واقعية سابقة:\n${lessons.map((l) => `- ${l.preventionRule}`).join('\n')}\n`
      : '';

  const hotlinesLines = meta.recommendedHotlines
    .map((h) => `- **${h.agency}:** رقم **${h.number}** (${h.description})`)
    .join('\n');

  return `${warmLead}

### ١. الخلاصة الصريحة لموقفك في القانون المصري
بناءً على ما ذكرته بشأن (${query.slice(0, 120)})، يندرج موضوعك تحت نطاق **${meta.matchedDomain}**${primaryArticle ? `، وتحديداً **${primaryArticle.articleNumber}** من **${primaryArticle.lawName}**` : ''}. موقفك يحفظه القانون إذا تحركت فوراً لتثبيت الأدلة دون تأخير.

### ٢. النصوص القانونية الحاكمة لحقك
${legalLines}
${secondaryArticles.length === 0 ? '' : ''}
### ٣. خطة التحرك والحلول الواقعية (٣ مسارات عملية)
* **المسار الأول (تأمين الأدلة والحل الودي الموثق):**
  ١. احتفظ فوراً بكل الأدلة (صور المحادثات كاملة برقم الهاتف أو الرابط، إيصالات التحويل البنكي أو المحفظة، أصل العقد أو الفاتورة) ولا تحذف أي رسالة.
  ٢. تجنب التوقيع على أي مخالصة أو إقرار بالتنازل قبل استلام كامل حقك فعلياً.
  ٣. في النزاعات المالية أو التعاقدية، وجّه مطالبة مكتوبة واضحة عبر تطبيق رسائل موثق أو إنذار رسمي يثبت امتناع الطرف الآخر.

* **المسار الثاني (التحرك الإداري وتحرير المحضر الرسمي):**
  ١. توجه فوراً إلى الجهة المختصة لتحرير **محضر إثبات حالة أو شكوى رسمية** واحصل على **رقم المحضر وتاريخه**:
${hotlinesLines}

* **المسار الثالث (المسار القضائي الحاسم):**
  ١. توجيه **إنذار رسمي على يد محضر** عبر المحكمة المختصة لقطع المواعيد القانونية وإلزام الطرف الآخر بالوفاء أو التنفيذ.
  ٢. رفع الدعوى المختصة أو متابعة تصرف النيابة العامة في المحضر مع تقديم حافظة مستندات وصور مطبوعة من الأدلة الرقمية.
${lessonsLines}
### ٤. خطواتك الفورية الآن
يمكنك استخدام **«محرر المستندات»** بالأعلى لصياغة إنذار رسمي أو شكوى جاهزة فوراً، أو طرح أي تفصيل إضافي هنا وسأكمل معك الخطة بدقة.

*(هذه الاستشارة للتوجيه القانوني الواقعي والتوعية، ولا تُغني عن الاستعانة بمحامٍ متخصص لمباشرة الإجراءات القضائية الفعلية)*`;
}

export const BASE_LEGAL_SYSTEM_INSTRUCTION = `أنت "اعرف حقك"، المستشار القانوني الإنساني الواقعي للمواطن المصري، المتخصص في تقديم إجابات صريحة واضحة وحلول عملية شاملة وفق القوانين السارية في جمهورية مصر العربية.

### أولاً: أسلوب الرد والهيكلة (إلزامي في كل رد):
1. **الاحتواء والدعم النفسي:** ابدأ بعبارة دافئة ومطمئنة تناسب حالة السائل النفسية دون إطالة مملة.
2. **الإجابة الصريحة والحل الحاسم مباشرة:** قل للمواطن بوضوح وصراحة: ما هو وضعه القانوني الحقيقي؟ وهل له حق أم عليه التزام؟ وما التصرف الأصح فوراً؟
3. **الأساس القانوني المصري الموثق:** استند حصراً إلى مواد القوانين المصرية المرفقة في السياق المرجعي (واذكر اسم القانون ورقم المادة وشرحها العملي ببساطة).
4. **3 مسارات حلول واقعية شاملة:**
   - **المسار الأول (التحرك الفوري وتأمين الأدلة والحل الودي):** ماذا يفعل اليوم بالتفصيل الدقيق وما الأدلة التي يجمعها؟
   - **المسار الثاني (الشكوى الإدارية ومحضر الشرطة والجهات الرسمية):** أين يذهب بالضبط في مصر (مكتب العمل، مباحث الإنترنت 108، حماية المستهلك 19588، قسم الشرطة، النيابة، محكمة الأسرة) وما الأوراق المطلوبة؟
   - **المسار الثالث (الإجراء القضائي الحاسم):** الإنذار على يد محضر أو الدعوى المختصة والمواعيد الحرجة التي لا يجوز تجاوزها.
5. **المستندات المطلوبة وأخطاء يجب تجنبها:** قائمة عملية مختصرة + تطبيق قواعد الوقاية المتعلّمة من السياق.

### ثانياً: قواعد صارمة:
- التزم حصرياً بالقانون المصري ولا تخترع أرقام مواد غير موجودة.
- أجب عن أي مشكلة ترفع إليك مهما كان نوعها إجابة عملية مفيدة وصريحة.
- اختم بالتنويه القانوني المختصر:
"(هذه الاستشارة للتوجيه القانوني الواقعي والتوعية، ولا تُغني عن الاستعانة بمحامٍ متخصص لمباشرة الإجراءات القضائية الفعلية)"`;
