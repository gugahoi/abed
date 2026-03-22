// Slack Block Kit types (subset used by this bot)

export type TextObject = {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
};

export type ButtonElement = {
  type: 'button';
  text: TextObject;
  action_id: string;
  value?: string;
  style?: 'primary' | 'danger';
};

export type StaticSelectOption = {
  text: TextObject;
  value: string;
};

export type StaticSelectElement = {
  type: 'static_select';
  placeholder: TextObject;
  action_id: string;
  options: StaticSelectOption[];
};

export type SectionBlock = {
  type: 'section';
  text: TextObject;
  accessory?: ButtonElement | StaticSelectElement;
};

export type ActionsBlock = {
  type: 'actions';
  block_id?: string;
  elements: (ButtonElement | StaticSelectElement)[];
};

export type DividerBlock = {
  type: 'divider';
};

export type ImageBlock = {
  type: 'image';
  image_url: string;
  alt_text: string;
};

export type Block = SectionBlock | ActionsBlock | DividerBlock | ImageBlock;
