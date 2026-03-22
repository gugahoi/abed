import type { RadarrSearchResult } from '../../radarr/types';
import type { RadarrClient } from '../../radarr/client';
import { createRequest, updateRequestStatus } from '../../db/index';
import { buildApprovalRequestMessage } from '../messages/index';
import { createLogger } from '../../logger';

const log = createLogger('submit');

type SubmitForApprovalParams = {
  movie: RadarrSearchResult;
  userId: string;
  client: {
    chat: { postMessage: (args: any) => Promise<any> };
    conversations: { join: (args: any) => Promise<any> };
  };
  radarrClient: RadarrClient;
  approvalChannelId: string;
};

type SubmitForApprovalResult = {
  success: boolean;
  alreadyExists?: boolean;
  error?: string;
};

export async function submitMovieForApproval(params: SubmitForApprovalParams): Promise<SubmitForApprovalResult> {
  const { movie, userId, client, radarrClient, approvalChannelId } = params;

  const exists = await radarrClient.movieExists(movie.tmdbId);
  if (exists) {
    log.info('Already in Radarr', { user: userId, movie: `${movie.title} (${movie.year})`, tmdbId: movie.tmdbId });
    return { success: false, alreadyExists: true };
  }

  const request = createRequest({
    movie_title: movie.title,
    tmdb_id: movie.tmdbId,
    imdb_id: movie.imdbId,
    year: movie.year,
    poster_url: movie.remotePoster,
    requester_slack_id: userId,
  });

  const postApprovalMessage = () =>
    client.chat.postMessage({
      channel: approvalChannelId,
      blocks: buildApprovalRequestMessage(
        {
          title: movie.title,
          year: movie.year,
          tmdbId: movie.tmdbId,
          posterUrl: movie.remotePoster ?? null,
          overview: movie.overview,
        },
        userId,
      ),
      text: `Movie request: ${movie.title} (${movie.year})`,
    });

  let result;
  try {
    result = await postApprovalMessage();
  } catch (postError: any) {
    if (postError?.data?.error === 'not_in_channel') {
      log.warn('Auto-joining approval channel', { channel: approvalChannelId });
      await client.conversations.join({ channel: approvalChannelId });
      result = await postApprovalMessage();
    } else {
      log.error('Error submitting for approval', { user: userId, tmdbId: movie.tmdbId, error: postError instanceof Error ? postError.message : String(postError) });
      throw postError;
    }
  }

  updateRequestStatus({
    id: request.id,
    status: 'pending',
    slack_message_ts: result.ts as string,
  });

  log.info('Approval posted', { movie: `${movie.title} (${movie.year})`, tmdbId: movie.tmdbId, requestId: request.id });

  return { success: true };
}
