import type { Block, StaticSelectOption } from './types';
import type { RadarrSearchResult } from '../../radarr/types';
import type { SonarrSearchResult } from '../../sonarr/types';

export const ACTION_IDS = {
  SELECT_MOVIE: 'select_movie',
  APPROVE_MOVIE: 'approve_movie',
  REJECT_MOVIE: 'reject_movie',
  SELECT_TV: 'select_tv',
  APPROVE_TV: 'approve_tv',
  REJECT_TV: 'reject_tv',
} as const;

export const BLOCK_IDS = {
  MOVIE_SELECT_ACTIONS: 'movie_select_actions',
  APPROVAL_ACTIONS: 'approval_actions',
  TV_SELECT_ACTIONS: 'tv_select_actions',
  TV_APPROVAL_ACTIONS: 'tv_approval_actions',
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

export function buildTvSearchResultsMessage(shows: SonarrSearchResult[]): Block[] {
  if (shows.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':mag: No TV shows found. Try a different search term.',
        },
      },
    ];
  }

  const options: StaticSelectOption[] = shows.slice(0, 25).map((show) => ({
    text: {
      type: 'plain_text' as const,
      text: `${show.title} (${show.year})`,
      emoji: true,
    },
    value: String(show.tvdbId),
  }));

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':tv: *Select the TV show you want to request:*',
      },
    },
    {
      type: 'actions',
      block_id: BLOCK_IDS.TV_SELECT_ACTIONS,
      elements: [
        {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose a TV show...',
            emoji: true,
          },
          action_id: ACTION_IDS.SELECT_TV,
          options,
        },
      ],
    },
  ];
}

export function buildTvApprovalRequestMessage(
  show: { title: string; year: number; overview?: string; posterUrl?: string | null; tvdbId: number; network?: string; seasonCount: number },
  requesterSlackId: string,
): Block[] {
  let headerText = `:tv: *TV Show Request*\n*${show.title} (${show.year})*`;
  if (show.network) {
    headerText += `\nNetwork: ${show.network}`;
  }
  headerText += `\nSeasons: ${show.seasonCount}`;
  headerText += `\nRequested by: <@${requesterSlackId}>`;

  const blocks: Block[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: headerText,
      },
    },
  ];

  if (show.overview) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_${show.overview.slice(0, 300)}${show.overview.length > 300 ? '...' : ''}_`,
      },
    });
  }

  if (show.posterUrl) {
    blocks.push({
      type: 'image',
      image_url: show.posterUrl,
      alt_text: `${show.title} poster`,
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'actions',
    block_id: BLOCK_IDS.TV_APPROVAL_ACTIONS,
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: ':white_check_mark: Approve', emoji: true },
        action_id: ACTION_IDS.APPROVE_TV,
        value: String(show.tvdbId),
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':x: Reject', emoji: true },
        action_id: ACTION_IDS.REJECT_TV,
        value: String(show.tvdbId),
        style: 'danger',
      },
    ],
  });

  return blocks;
}

export function buildTvApprovedMessage(
  show: { title: string; year: number },
  requesterSlackId: string,
  approverSlackId: string,
): Block[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *${show.title} (${show.year})* has been *approved* by <@${approverSlackId}>!\nRequested by: <@${requesterSlackId}>\n\nSonarr is now searching for this show. You'll be notified when it's available.`,
      },
    },
  ];
}

export function buildTvRejectedMessage(
  show: { title: string; year: number },
  requesterSlackId: string,
  approverSlackId: string,
  reason?: string,
): Block[] {
  const text = reason
    ? `:x: *${show.title} (${show.year})* has been *rejected* by <@${approverSlackId}>.\nRequested by: <@${requesterSlackId}>\nReason: ${reason}`
    : `:x: *${show.title} (${show.year})* has been *rejected* by <@${approverSlackId}>.\nRequested by: <@${requesterSlackId}>`;

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];
}
