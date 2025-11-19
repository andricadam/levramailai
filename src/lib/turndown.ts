import TurndownService from 'turndown';

const turndownService = new TurndownService();

export const turndown = {
  turndown: (html: string) => turndownService.turndown(html),
};

