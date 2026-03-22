import type { Block, StaticSelectOption } from './types';
import type { RadarrSearchResult } from '../../radarr/types';

export const ACTION_IDS = {
  SELECT_MOVIE: 'select_movie',
  APPROVE_MOVIE: 'approve_movie',
  REJECT_MOVIE: 'reject_movie',
} as const;

export const BLOCK_IDS = {
  MOVIE_SELECT_ACTIONS: 'movie_select_actions',
  APPROVAL_ACTIONS: 'approval_actions',
} as const;

export function buildSearchResultsMessage(movies: RadarrSearchResult[]): Block[] {
  if (movies.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':mag: No movies found. Try a different search term.',
        },
      },
    ];
  }

  const options: StaticSelectOption[] = movies.slice(0, 25).map((movie) => ({
    text: {
      type: 'plain_text' as const,
      text: `${movie.title} (${movie.year})`,
      emoji: true,
    },
    // Use only tmdbId as value — Slack's static_select value max is 150 chars.
    // The action handler looks up the full movie data from the in-memory search cache.
    value: String(movie.tmdbId),
  }));

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':clapper: *Select the movie you want to request:*',
      },
    },
    {
      type: 'actions',
      block_id: BLOCK_IDS.MOVIE_SELECT_ACTIONS,
      elements: [
        {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose a movie...',
            emoji: true,
          },
          action_id: ACTION_IDS.SELECT_MOVIE,
          options,
        },
      ],
    },
  ];
}

export function buildApprovalRequestMessage(
  movie: { title: string; year: number; overview?: string; posterUrl?: string | null; tmdbId: number },
  requesterSlackId: string,
): Block[] {
  const blocks: Block[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:film_frames: *Movie Request*\n*${movie.title} (${movie.year})*\nRequested by: <@${requesterSlackId}>`,
      },
    },
  ];

  if (movie.overview) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_${movie.overview.slice(0, 300)}${movie.overview.length > 300 ? '...' : ''}_`,
      },
    });
  }

  if (movie.posterUrl) {
    blocks.push({
      type: 'image',
      image_url: movie.posterUrl,
      alt_text: `${movie.title} poster`,
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'actions',
    block_id: BLOCK_IDS.APPROVAL_ACTIONS,
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: ':white_check_mark: Approve', emoji: true },
        action_id: ACTION_IDS.APPROVE_MOVIE,
        value: String(movie.tmdbId),
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':x: Reject', emoji: true },
        action_id: ACTION_IDS.REJECT_MOVIE,
        value: String(movie.tmdbId),
        style: 'danger',
      },
    ],
  });

  return blocks;
}

export function buildApprovedMessage(
  movie: { title: string; year: number },
  requesterSlackId: string,
  approverSlackId: string,
): Block[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *${movie.title} (${movie.year})* has been *approved* by <@${approverSlackId}>!\nRequested by: <@${requesterSlackId}>\n\nRadarr is now searching for this movie. You'll be notified when it's available.`,
      },
    },
  ];
}

export function buildRejectedMessage(
  movie: { title: string; year: number },
  requesterSlackId: string,
  approverSlackId: string,
  reason?: string,
): Block[] {
  const text = reason
    ? `:x: *${movie.title} (${movie.year})* has been *rejected* by <@${approverSlackId}>.\nRequested by: <@${requesterSlackId}>\nReason: ${reason}`
    : `:x: *${movie.title} (${movie.year})* has been *rejected* by <@${approverSlackId}>.\nRequested by: <@${requesterSlackId}>`;

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];
}
