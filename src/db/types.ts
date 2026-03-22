export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'already_exists' | 'failed';

export type MovieRequest = {
  id: number;
  movie_title: string;
  tmdb_id: number;
  imdb_id: string | null;
  year: number;
  poster_url: string | null;
  requester_slack_id: string;
  approver_slack_id: string | null;
  status: RequestStatus;
  slack_message_ts: string | null; // timestamp of approval message in Slack
  downloaded_notified: number; // 0 = not notified, 1 = notified
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

export type CreateRequestInput = {
  movie_title: string;
  tmdb_id: number;
  imdb_id?: string | null;
  year: number;
  poster_url?: string | null;
  requester_slack_id: string;
  slack_message_ts?: string | null;
};

export type UpdateRequestStatusInput = {
  id: number;
  status: RequestStatus;
  approver_slack_id?: string;
  slack_message_ts?: string;
};

export type TvRequest = {
  id: number;
  show_title: string;
  tvdb_id: number;
  year: number;
  poster_url: string | null;
  requester_slack_id: string;
  approver_slack_id: string | null;
  status: RequestStatus;
  slack_message_ts: string | null;
  downloaded_notified: number; // 0 = not notified, 1 = notified
  created_at: string;
  updated_at: string;
};

export type CreateTvRequestInput = {
  show_title: string;
  tvdb_id: number;
  year: number;
  poster_url?: string | null;
  requester_slack_id: string;
  slack_message_ts?: string | null;
};

export type UpdateTvRequestStatusInput = {
  id: number;
  status: RequestStatus;
  approver_slack_id?: string;
  slack_message_ts?: string;
};
