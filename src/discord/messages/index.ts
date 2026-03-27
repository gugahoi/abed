import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { RadarrSearchResult } from '../../radarr/types';
import type { SonarrSearchResult } from '../../sonarr/types';
import type { MovieRequest, TvRequest } from '../../db/types';

// ============================================================================
// MOVIE MESSAGES
// ============================================================================

export function buildSearchResultsEmbed(results: RadarrSearchResult[]) {
  if (results.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor('#ffcc00')
          .setDescription('No results found. Try a different title.'),
      ],
      components: [],
    };
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Movie Search Results')
    .setDescription('Select a movie from the dropdown below to request it.');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_movie')
    .setPlaceholder('Choose a movie...')
    .addOptions(
      results.slice(0, 25).map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${r.title} (${r.year})`)
          .setValue(r.tmdbId.toString())
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return {
    embeds: [embed],
    components: [row],
  };
}

export function buildApprovalRequestEmbed(movie: RadarrSearchResult, requesterDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#ffcc00')
    .setTitle(`Movie Request: ${movie.title} (${movie.year})`)
    .setDescription(`Requested by <@${requesterDiscordId}>`)
    .addFields(
      { name: 'TMDB ID', value: movie.tmdbId.toString(), inline: true },
      { name: 'Status', value: 'Pending Approval ⏳', inline: true }
    );

  if (movie.overview) {
    embed.addFields({ name: 'Overview', value: movie.overview.substring(0, 1024) });
  }

  if (movie.remotePoster) {
    embed.setThumbnail(movie.remotePoster);
  }

  const approveBtn = new ButtonBuilder()
    .setCustomId(`approve_movie_${movie.tmdbId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success);

  const rejectBtn = new ButtonBuilder()
    .setCustomId(`reject_movie_${movie.tmdbId}`)
    .setLabel('Reject')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn);

  return {
    embeds: [embed],
    components: [row],
  };
}

export function buildApprovedEmbed(movie: MovieRequest, approverDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle(`Movie Request: ${movie.movie_title} (${movie.year})`)
    .setDescription(`Requested by <@${movie.requester_slack_id}>`)
    .addFields(
      { name: 'TMDB ID', value: movie.tmdb_id.toString(), inline: true },
      { name: 'Status', value: `Approved by <@${approverDiscordId}> ✅`, inline: true }
    );

  if (movie.poster_url) embed.setThumbnail(movie.poster_url);

  return { embeds: [embed], components: [] };
}

export function buildRejectedEmbed(movie: MovieRequest, approverDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle(`Movie Request: ${movie.movie_title} (${movie.year})`)
    .setDescription(`Requested by <@${movie.requester_slack_id}>`)
    .addFields(
      { name: 'TMDB ID', value: movie.tmdb_id.toString(), inline: true },
      { name: 'Status', value: `Rejected by <@${approverDiscordId}> ❌`, inline: true }
    );

  if (movie.poster_url) embed.setThumbnail(movie.poster_url);

  return { embeds: [embed], components: [] };
}

// ============================================================================
// TV MESSAGES
// ============================================================================

export function buildTvSearchResultsEmbed(results: SonarrSearchResult[]) {
  if (results.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor('#ffcc00')
          .setDescription('No results found. Try a different title.'),
      ],
      components: [],
    };
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('TV Show Search Results')
    .setDescription('Select a show from the dropdown below to request it.');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_tv')
    .setPlaceholder('Choose a show...')
    .addOptions(
      results.slice(0, 25).map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${r.title} (${r.year})`)
          .setDescription(`${r.network || 'Unknown Network'} • ${r.seasons?.length || 0} seasons`)
          .setValue(r.tvdbId.toString())
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return {
    embeds: [embed],
    components: [row],
  };
}

export function buildTvApprovalRequestEmbed(show: SonarrSearchResult, requesterDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#ffcc00')
    .setTitle(`TV Request: ${show.title} (${show.year})`)
    .setDescription(`Requested by <@${requesterDiscordId}>`)
    .addFields(
      { name: 'Network', value: show.network || 'Unknown', inline: true },
      { name: 'Seasons', value: (show.seasons?.length || 0).toString(), inline: true },
      { name: 'TVDB ID', value: show.tvdbId.toString(), inline: true },
      { name: 'Status', value: 'Pending Approval ⏳', inline: true }
    );

  if (show.overview) {
    embed.addFields({ name: 'Overview', value: show.overview.substring(0, 1024) });
  }

  const poster = show.images?.find((img) => img.coverType === 'poster')?.remoteUrl;
  if (poster) {
    embed.setThumbnail(poster);
  }

  const approveBtn = new ButtonBuilder()
    .setCustomId(`approve_tv_${show.tvdbId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success);

  const rejectBtn = new ButtonBuilder()
    .setCustomId(`reject_tv_${show.tvdbId}`)
    .setLabel('Reject')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn);

  return {
    embeds: [embed],
    components: [row],
  };
}

export function buildTvApprovedEmbed(show: TvRequest, approverDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle(`TV Request: ${show.show_title} (${show.year})`)
    .setDescription(`Requested by <@${show.requester_slack_id}>`)
    .addFields(
      { name: 'TVDB ID', value: show.tvdb_id.toString(), inline: true },
      { name: 'Status', value: `Approved by <@${approverDiscordId}> ✅`, inline: true }
    );

  if (show.poster_url) embed.setThumbnail(show.poster_url);

  return { embeds: [embed], components: [] };
}

export function buildTvRejectedEmbed(show: TvRequest, approverDiscordId: string) {
  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle(`TV Request: ${show.show_title} (${show.year})`)
    .setDescription(`Requested by <@${show.requester_slack_id}>`)
    .addFields(
      { name: 'TVDB ID', value: show.tvdb_id.toString(), inline: true },
      { name: 'Status', value: `Rejected by <@${approverDiscordId}> ❌`, inline: true }
    );

  if (show.poster_url) embed.setThumbnail(show.poster_url);

  return { embeds: [embed], components: [] };
}

// ============================================================================
// MY REQUESTS
// ============================================================================

export function buildMyRequestsEmbed(requests: (MovieRequest | TvRequest)[]) {
  if (requests.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor('#cccccc')
          .setDescription('You have no requests matching that status.'),
      ],
    };
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Your Requests (${requests.length})`)
    .setDescription('Here are your most recent requests:');

  requests.forEach((req) => {
    const isMovie = 'movie_title' in req;
    const title = isMovie ? req.movie_title : req.show_title;
    const icon = isMovie ? '🎬' : '📺';
    
    let statusIcon = '⏳';
    if (req.status === 'approved') statusIcon = '✅';
    if (req.status === 'rejected') statusIcon = '❌';
    if (req.status === 'already_exists') statusIcon = '📚';
    if (req.status === 'failed') statusIcon = '⚠️';

    embed.addFields({
      name: `${icon} ${title} (${req.year})`,
      value: `Status: ${statusIcon} ${req.status}\nDate: ${new Date(req.created_at).toLocaleDateString()}`,
      inline: false,
    });
  });

  return { embeds: [embed] };
}
