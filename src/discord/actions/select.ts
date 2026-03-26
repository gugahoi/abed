import { StringSelectMenuInteraction, MessageFlags, TextChannel } from 'discord.js';
import type { RadarrClient } from '../../radarr/client';
import type { SonarrClient } from '../../sonarr/client';
import { getResults, clearResults, getTvResults, clearTvResults } from '../../core/searchCache';
import { createRequest, createTvRequest, getRequestByTmdbId, getTvRequestByTvdbId } from '../../db/index';
import { buildApprovalRequestEmbed, buildTvApprovalRequestEmbed } from '../messages/index';
import { createLogger } from '../../logger';

const log = createLogger('discord-select-actions');

export async function handleSelectMovie(
  interaction: StringSelectMenuInteraction,
  deps: { radarrClient: RadarrClient; approvalChannelId: string }
) {
  const userId = interaction.user.id;
  const tmdbIdStr = interaction.values[0];
  
  if (!tmdbIdStr) return;
  const tmdbId = parseInt(tmdbIdStr, 10);

  log.info('Movie selected', { user: userId, tmdbId });

  // Discord interaction responses must be quick, defer it
  await interaction.deferUpdate();

  const results = getResults(`discord_${userId}`);
  if (!results) {
    log.warn('Search cache expired', { user: userId });
    await interaction.followUp({
      content: '⏳ Search results expired. Please run `/movie` again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const movie = results.find((r) => r.tmdbId === tmdbId);
  if (!movie) {
    log.warn('Movie not found in cache', { user: userId, tmdbId });
    await interaction.followUp({
      content: '❌ Could not find that movie in your recent search.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const isDuplicate = await deps.radarrClient.movieExists(movie.tmdbId);
    if (isDuplicate) {
      log.info('Movie already exists', { user: userId, tmdbId });
      
      const existingReq = getRequestByTmdbId(tmdbId);
      if (!existingReq || existingReq.status !== 'already_exists') {
        createRequest({
          movie_title: movie.title,
          tmdb_id: movie.tmdbId,
          imdb_id: movie.imdbId,
          year: movie.year,
          poster_url: movie.remotePoster,
          requester_slack_id: userId,
          platform: 'discord',
        });
        // We'd update status to already_exists here if doing a 2-step but db defaults to pending
        // Slack submitForApproval handles this cleanly, will refactor this later to use shared logic
      }

      await interaction.followUp({
        content: `ℹ️ **${movie.title} (${movie.year})** is already in the library!`,
        flags: MessageFlags.Ephemeral,
      });
      clearResults(`discord_${userId}`);
      return;
    }

    // Post to approval channel
    const approvalChannel = await interaction.client.channels.fetch(deps.approvalChannelId) as TextChannel;
    if (!approvalChannel) {
        throw new Error('Approval channel not found or bot lacks access');
    }

    const approvalMsg = buildApprovalRequestEmbed(movie, userId);
    const sentMsg = await approvalChannel.send({ ...approvalMsg });

    // DB Record
    createRequest({
      movie_title: movie.title,
      tmdb_id: movie.tmdbId,
      imdb_id: movie.imdbId,
      year: movie.year,
      poster_url: movie.remotePoster,
      requester_slack_id: userId,
      slack_message_ts: sentMsg.id, // Reusing slack_message_ts for Discord Message ID
      platform: 'discord',
    });

    log.info('Approval request posted', { user: userId, tmdbId, messageId: sentMsg.id });

    clearResults(`discord_${userId}`);

    await interaction.followUp({
      content: `✅ Your request for **${movie.title} (${movie.year})** has been submitted for approval!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    log.error('Failed to process movie selection', { user: userId, error: error instanceof Error ? error.message : String(error) });
    await interaction.followUp({
      content: '❌ Something went wrong. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleSelectTv(
  interaction: StringSelectMenuInteraction,
  deps: { sonarrClient?: SonarrClient | null; approvalChannelId: string }
) {
  const userId = interaction.user.id;
  const tvdbIdStr = interaction.values[0];
  
  if (!tvdbIdStr || !deps.sonarrClient) return;
  const tvdbId = parseInt(tvdbIdStr, 10);

  log.info('TV show selected', { user: userId, tvdbId });

  await interaction.deferUpdate();

  const results = getTvResults(`discord_${userId}`);
  if (!results) {
    log.warn('TV search cache expired', { user: userId });
    await interaction.followUp({
      content: '⏳ Search results expired. Please run `/tv` again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const show = results.find((r) => r.tvdbId === tvdbId);
  if (!show) {
    log.warn('Show not found in cache', { user: userId, tvdbId });
    await interaction.followUp({
      content: '❌ Could not find that show in your recent search.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const isDuplicate = await deps.sonarrClient.seriesExists(show.tvdbId);
    if (isDuplicate) {
      log.info('Show already exists', { user: userId, tvdbId });
      await interaction.followUp({
        content: `ℹ️ **${show.title} (${show.year})** is already in the library!`,
        flags: MessageFlags.Ephemeral,
      });
      clearTvResults(`discord_${userId}`);
      return;
    }

    // Post to approval channel
    const approvalChannel = await interaction.client.channels.fetch(deps.approvalChannelId) as TextChannel;
    if (!approvalChannel) {
        throw new Error('Approval channel not found or bot lacks access');
    }

    const approvalMsg = buildTvApprovalRequestEmbed(show, userId);
    const sentMsg = await approvalChannel.send({ ...approvalMsg });

    // DB Record
    createTvRequest({
      show_title: show.title,
      tvdb_id: show.tvdbId,
      year: show.year,
      poster_url: show.images?.find((img) => img.coverType === 'poster')?.remoteUrl,
      requester_slack_id: userId,
      slack_message_ts: sentMsg.id, // Reusing field for Message ID
      platform: 'discord',
    });

    log.info('TV approval request posted', { user: userId, tvdbId, messageId: sentMsg.id });

    clearTvResults(`discord_${userId}`);

    await interaction.followUp({
      content: `✅ Your request for **${show.title} (${show.year})** has been submitted for approval!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    log.error('Failed to process TV selection', { user: userId, error: error instanceof Error ? error.message : String(error) });
    await interaction.followUp({
      content: '❌ Something went wrong. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
