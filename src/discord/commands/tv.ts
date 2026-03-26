import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { SonarrClient } from '../../sonarr/client';
import { getTvResults, storeTvResults } from '../../core/searchCache';
import { buildTvSearchResultsEmbed } from '../messages/index';
import { createLogger } from '../../logger';

const log = createLogger('discord-tv-cmd');

export const tvCommandDef = new SlashCommandBuilder()
  .setName('tv')
  .setDescription('Search and request a TV show from Sonarr')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('The title of the TV show')
      .setRequired(true)
  );

export async function executeTvCommand(
  interaction: ChatInputCommandInteraction,
  deps: { sonarr: { sonarrClient: SonarrClient } | null }
) {
  const userId = interaction.user.id;

  if (!deps.sonarr) {
    log.info('/tv command used but Sonarr is not configured', { user: userId });
    await interaction.reply({
      content: '❌ TV show requests are not configured.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const query = interaction.options.getString('title', true).trim();
  log.info('/tv command', { user: userId, query });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const results = await deps.sonarr.sonarrClient.searchSeries(query);

    if (results.length === 0) {
      log.warn('No results', { user: userId, query });
      await interaction.editReply({
        content: `🤔 No results found for **${query}**. Try a different title.`,
      });
      return;
    }

    // Cache results using platform prefix
    storeTvResults(`discord_${userId}`, results.slice(0, 25));

    log.info('Search complete', { user: userId, query, results: results.length });

    const messagePayload = buildTvSearchResultsEmbed(results);
    await interaction.editReply({
      content: `Search results for: **${query}**`,
      ...messagePayload,
    });
  } catch (error) {
    log.error('Error in /tv command', { user: userId, error: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({
      content: '❌ Failed to search for TV shows. Please try again.',
    });
  }
}
