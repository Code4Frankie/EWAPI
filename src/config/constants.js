// Nasarawa State's 13 Local Government Areas
const LGAS = [
  'Akwanga', 'Awe', 'Doma', 'Karu', 'Keana', 'Keffi', 'Kokona',
  'Lafia', 'Nasarawa', 'Nasarawa Egon', 'Obi', 'Toto', 'Wamba',
];

const ROLES = ['observer', 'moderator', 'admin'];

const CATEGORIES = [
  'violence', 'vote_buying', 'ballot_snatching', 'intimidation', 'late_opening',
  'result_tampering', 'voter_suppression', 'equipment_failure', 'logistics', 'other',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['new', 'under_review', 'verified', 'rejected', 'escalated', 'resolved'];
const CHANNELS = ['web', 'sms', 'voice'];

// Allowed status moves. Admins may additionally reopen rejected/resolved reports.
const TRANSITIONS = {
  new: ['under_review', 'rejected'],
  under_review: ['verified', 'rejected', 'escalated'],
  verified: ['escalated', 'resolved'],
  escalated: ['resolved'],
  rejected: [],
  resolved: [],
};
const REOPEN_TO = 'under_review';

// Short codes observers can type in an SMS: EW <POLLING_UNIT_CODE> <CODE> <message>
const SMS_CATEGORY_CODES = {
  VIOLENCE: 'violence',
  VOTEBUY: 'vote_buying',
  BALLOT: 'ballot_snatching',
  THREAT: 'intimidation',
  LATE: 'late_opening',
  RESULT: 'result_tampering',
  SUPPRESS: 'voter_suppression',
  BVAS: 'equipment_failure',
  LOGISTICS: 'logistics',
  OTHER: 'other',
};

export {
  LGAS, ROLES, CATEGORIES, SEVERITIES, STATUSES, CHANNELS,
  TRANSITIONS, REOPEN_TO, SMS_CATEGORY_CODES,
};
