import { describe, it, expect } from 'bun:test';
import {
  buildSearchResultsMessage,
  buildApprovalRequestMessage,
  buildApprovedMessage,
  buildRejectedMessage,
  ACTION_IDS,
  BLOCK_IDS,
} from '../../src/slack/messages/index';
import type { RadarrSearchResult } from '../../src/radarr/types';

const mockMovie: RadarrSearchResult = {
  title: 'The Batman',
  year: 2022,
  tmdbId: 12345,
  titleSlug: 'the-batman',
  images: [],
  imdbId: 'tt1877830',
  remotePoster: 'https://example.com/poster.jpg',
  overview: 'When a sadistic serial killer begins murdering key political figures in Gotham...',
};

describe('buildSearchResultsMessage', () => {
  it('returns no-results message when empty array', () => {
    const blocks = buildSearchResultsMessage([]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'section' });
  });

  it('returns section + actions blocks for search results', () => {
    const blocks = buildSearchResultsMessage([mockMovie]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe('section');
    expect(blocks[1]!.type).toBe('actions');
  });

  it('actions block has static_select element', () => {
    const blocks = buildSearchResultsMessage([mockMovie]);
    const actionsBlock = blocks[1] as any;
    expect(actionsBlock.block_id).toBe(BLOCK_IDS.MOVIE_SELECT_ACTIONS);
    expect(actionsBlock.elements[0].type).toBe('static_select');
    expect(actionsBlock.elements[0].action_id).toBe(ACTION_IDS.SELECT_MOVIE);
  });

  it('uses tmdbId string as option value (stays within Slack 150-char limit)', () => {
    const blocks = buildSearchResultsMessage([mockMovie]);
    const actionsBlock = blocks[1] as any;
    const optionValue = actionsBlock.elements[0].options[0].value;
    expect(optionValue).toBe('12345');
    expect(optionValue.length).toBeLessThanOrEqual(150);
  });

  it('limits options to 25 movies', () => {
    const manyMovies = Array.from({ length: 30 }, (_, i) => ({
      ...mockMovie,
      tmdbId: i + 1,
      title: `Movie ${i + 1}`,
    }));
    const blocks = buildSearchResultsMessage(manyMovies);
    const actionsBlock = blocks[1] as any;
    expect(actionsBlock.elements[0].options).toHaveLength(25);
  });
});

describe('buildApprovalRequestMessage', () => {
  it('includes title, year, and requester mention', () => {
    const blocks = buildApprovalRequestMessage(
      { title: 'The Batman', year: 2022, tmdbId: 12345, posterUrl: null },
      'U_REQUESTER',
    );
    const firstBlock = blocks[0] as any;
    expect(firstBlock.text.text).toContain('The Batman');
    expect(firstBlock.text.text).toContain('2022');
    expect(firstBlock.text.text).toContain('<@U_REQUESTER>');
  });

  it('includes approve and reject buttons', () => {
    const blocks = buildApprovalRequestMessage(
      { title: 'The Batman', year: 2022, tmdbId: 12345, posterUrl: null },
      'U_REQUESTER',
    );
    const actionsBlock = blocks.find((b) => b.type === 'actions') as any;
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements[0].action_id).toBe(ACTION_IDS.APPROVE_MOVIE);
    expect(actionsBlock.elements[1].action_id).toBe(ACTION_IDS.REJECT_MOVIE);
  });

  it('approve button has style primary and reject has danger', () => {
    const blocks = buildApprovalRequestMessage(
      { title: 'The Batman', year: 2022, tmdbId: 12345, posterUrl: null },
      'U_REQUESTER',
    );
    const actionsBlock = blocks.find((b) => b.type === 'actions') as any;
    expect(actionsBlock.elements[0].style).toBe('primary');
    expect(actionsBlock.elements[1].style).toBe('danger');
  });
});

describe('buildApprovedMessage', () => {
  it('includes approved text with approver mention', () => {
    const blocks = buildApprovedMessage({ title: 'The Batman', year: 2022 }, 'U_REQ', 'U_APP');
    const firstBlock = blocks[0] as any;
    expect(firstBlock.text.text).toContain('approved');
    expect(firstBlock.text.text).toContain('<@U_APP>');
    expect(firstBlock.text.text).toContain('<@U_REQ>');
  });
});

describe('buildRejectedMessage', () => {
  it('includes rejected text without reason', () => {
    const blocks = buildRejectedMessage({ title: 'The Batman', year: 2022 }, 'U_REQ', 'U_APP');
    const firstBlock = blocks[0] as any;
    expect(firstBlock.text.text).toContain('rejected');
    expect(firstBlock.text.text).not.toContain('Reason:');
  });

  it('includes reason when provided', () => {
    const blocks = buildRejectedMessage({ title: 'The Batman', year: 2022 }, 'U_REQ', 'U_APP', 'Already on Plex');
    const firstBlock = blocks[0] as any;
    expect(firstBlock.text.text).toContain('Reason: Already on Plex');
  });
});
