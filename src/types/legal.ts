export type LegalDomainId =
  | 'labor'
  | 'civil'
  | 'penal'
  | 'cyber'
  | 'family'
  | 'rent'
  | 'consumer'
  | 'criminal_proc';

export type EmotionalState = 'distressed' | 'angry' | 'confused' | 'calm';

export type AutoDeleteOption = 'close' | '15m' | '60m' | 'manual';

export interface LawArticle {
  id: string;
  domain: LegalDomainId;
  domainNameAr: string;
  lawName: string;
  lawNumber: string;
  articleNumber: string;
  chapter: string;
  title: string;
  officialText: string;
  plainSummary: string;
  keywords: string[];
  prescriptionPeriod?: string;
}

export interface HotlineEntry {
  id: string;
  agency: string;
  number: string;
  category: 'emergency' | 'cyber' | 'family' | 'consumer' | 'labor' | 'complaints';
  categoryAr: string;
  description: string;
  availability: string;
}

export interface SentimentAnalysis {
  state: EmotionalState;
  labelAr: string;
  needsGroundingExercise: boolean;
  reassuranceLead: string;
  urgencyLevel: 'high' | 'medium' | 'normal';
}

export interface LearnedLesson {
  id: string;
  domain: string;
  patternSummary: string;
  preventionRule: string;
  type: 'verified' | 'correction';
  createdAt: string;
  hits: number;
}

export interface PlatformInsights {
  totalVerifiedCases: number;
  totalCorrectionsLearned: number;
  activeRules: LearnedLesson[];
  topDomains: Array<{ domain: string; count: number }>;
}

export interface ConsultationMeta {
  sentiment: SentimentAnalysis;
  matchedDomain: string;
  retrievedArticles: LawArticle[];
  recommendedHotlines: HotlineEntry[];
  appliedLessonsCount: number;
  fromCache: boolean;
  queuePosition: number;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachment?: {
    name: string;
    mimeType: string;
    previewUrl?: string;
  };
  meta?: ConsultationMeta;
  proactiveSuggestions?: string[];
  feedbackGiven?: 'helpful' | 'corrected';
  isStreaming?: boolean;
  error?: string;
}

export interface SavedConsultation {
  id: string;
  title: string;
  updatedAt: string;
  domain: string;
  messages: ChatMessage[];
}

export interface ContractClauseFinding {
  clauseTitle: string;
  severity: 'critical' | 'warning' | 'safe';
  severityAr: string;
  legalBasis: string;
  explanation: string;
  recommendedEdit: string;
}

export interface ContractAuditResult {
  documentType: string;
  overallRisk: 'high' | 'medium' | 'low';
  overallRiskAr: string;
  executiveSummary: string;
  findings: ContractClauseFinding[];
  missingProtections: string[];
  nextSteps: string[];
}

export interface DraftedDocumentResult {
  documentTitle: string;
  targetAuthority: string;
  legalBasis: string;
  fullText: string;
  requiredAttachments: string[];
  filingSteps: string[];
}
