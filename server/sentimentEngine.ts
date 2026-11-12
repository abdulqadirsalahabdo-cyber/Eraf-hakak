import type { SentimentAnalysis } from '../src/types/legal.ts';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

const DISTRESS_CUES = [
  'خايف', 'مرعوب', 'رعب', 'منهار', 'بعيط', 'مكتئب', 'هموت', 'مهدد',
  'ابتزاز', 'فضيحه', 'كارثه', 'مصيبه', 'اتحبس', 'سجن', 'هتجنن', 'قلبي',
  'مكسور', 'مش عارف انام', 'تعبان نفسيا', 'تدمرت', 'محدش جنبي', 'الحقوني',
  'انقذوني', 'بيهددني', 'حياتي اتدمرت', 'هتفضح', 'اتقبض', 'النجده'
];

const ANGRY_CUES = [
  'حسبي الله', 'ظلم', 'ظالم', 'نصاب', 'حرامي', 'سرقني', 'كلب', 'زفت',
  'ضحك عليا', 'مستفز', 'قهرتني', 'قهر', 'اتظلمت', 'غش', 'نصب عليا',
  'طردوني', 'مفصول', 'باطل', 'افترى', 'بيستغلني', 'هفضحه'
];

const CONFUSED_CUES = [
  'مش فاهم', 'تايه', 'محتار', 'اعمل ايه', 'ايه الحل', 'اتصرف ازاي',
  'ممكن تشرح', 'مش عارف', 'ابدا منين', 'ايه الورق', 'ينفع ولا لا', 'متلخبط'
];

export function analyzeArabicSentiment(text: string): SentimentAnalysis {
  const norm = normalize(text);

  let distressHits = 0;
  let angryHits = 0;
  let confusedHits = 0;

  for (const cue of DISTRESS_CUES) {
    if (norm.includes(normalize(cue))) distressHits++;
  }
  for (const cue of ANGRY_CUES) {
    if (norm.includes(normalize(cue))) angryHits++;
  }
  for (const cue of CONFUSED_CUES) {
    if (norm.includes(normalize(cue))) confusedHits++;
  }

  // Punctuation urgency signal (e.g. multiple exclamation/question marks)
  const urgencyMarks = (text.match(/[!؟?]{2,}/g) ?? []).length;
  if (urgencyMarks > 0 && distressHits > 0) distressHits++;

  if (distressHits >= 1 && distressHits >= angryHits) {
    return {
      state: 'distressed',
      labelAr: 'تحتاج إلى طمأنة عاجلة واحتواء',
      needsGroundingExercise: true,
      reassuranceLead:
        'استخدم نبرة هادئة جداً، دافئة، وحاضنة نفسياً. اطلب من المستخدم أولاً أن يلتقط أنفاسه واطمئنه بوضوح أن القانون المصري يقف في صفه وأن الموقف قابل للحل بخطوات هادئة ومنظمة قبل الخوض في النصوص القانونية.',
      urgencyLevel: 'high'
    };
  }

  if (angryHits >= 1) {
    return {
      state: 'angry',
      labelAr: 'مشاعر ظلم وغضب تحتاج توجيهاً حازماً وهادئاً',
      needsGroundingExercise: false,
      reassuranceLead:
        'تفهّم مشاعر الظلم والغضب لدى المستخدم واعترف بأن ما حدث غير مقبول، ثم حوّل طاقة الغضب إلى خطوات قانونية منضبطة تحفظ حقه دون أي تصرف متهور قد يضر بموقفه القانوني.',
      urgencyLevel: 'medium'
    };
  }

  if (confusedHits >= 1) {
    return {
      state: 'confused',
      labelAr: 'حاجة لترتيب الأفكار وخريطة طريق مبسطة',
      needsGroundingExercise: false,
      reassuranceLead:
        'ابدأ بطمأنة المستخدم بأن تشتت الأفكار طبيعي في المواقف القانونية، وقدّم الإجابة في نقاط مرقمة واضحة وبسيطة جداً بعيدة عن التعقيد المصطلحي.',
      urgencyLevel: 'normal'
    };
  }

  return {
    state: 'calm',
    labelAr: 'استشارة قانونية هادئة ومباشرة',
    needsGroundingExercise: false,
    reassuranceLead:
      'ابدأ بترحيب إنساني دافئ ومطمئن، ثم انتقل مباشرة إلى التكييف القانوني الدقيق والنصوص الرسمية وخطة التحرك.',
    urgencyLevel: 'normal'
  };
}
