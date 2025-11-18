export interface SubTopic {
  title: string;
  description: string;
}

export interface ResearchSection {
  title: string;
  content: string[];
  subTopics?: SubTopic[];
}

export interface CachedSubTopic {
    section: ResearchSection;
    imageUrl: string | null;
}

export interface CachedTopic {
    section: ResearchSection;
    imageUrl: string | null;
    subTopics?: Partial<Record<string, CachedSubTopic>>;
}

export interface ResearchData {
  origins: ResearchSection;
  howItWorks: ResearchSection;
  keysToSuccess: ResearchSection;
  failureReasons: ResearchSection;
  risks: ResearchSection;
  benefits: ResearchSection;
}
