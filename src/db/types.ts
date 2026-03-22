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
