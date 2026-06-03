export type NotionClientLike = {
  dataSources: {
    query(args: Record<string, unknown>): Promise<{
      results: Array<Record<string, unknown>>;
      has_more?: boolean;
      next_cursor?: string | null;
    }>;
  };
  pages: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    retrieve(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

export type ResolvedPage = {
  id: string;
  title: string;
  url?: string;
};
