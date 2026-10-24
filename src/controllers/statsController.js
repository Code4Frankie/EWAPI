import Report from '../models/Report.js';
import asyncHandler from '../utils/asyncHandler.js';

const summary = asyncHandler(async (req, res) => {
  const match = {};
  if (req.user.role === 'moderator' && req.user.assignedStates?.length) {
    match['location.state'] = { $in: req.user.assignedStates };
  }
  const only = typeof req.query.state === 'string' ? req.query.state : null;
  if (only) match['location.state'] = only;
  const count = (field) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }];

  const [r] = await Report.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'n' }],
        byStatus: count('status'),
        byCategory: count('category'),
        bySeverity: count('severity'),
        byChannel: count('channel'),
        byState: count('location.state'),
        byLga: count('location.lga'),
        unverifiedSources: [{ $match: { reporterVerified: false } }, { $count: 'n' }],
        openCritical: [
          { $match: { severity: 'critical', status: { $in: ['new', 'under_review', 'verified', 'escalated'] } } },
          { $count: 'n' },
        ],
      },
    },
  ]);

  const flat = (rows) => Object.fromEntries(rows.map((x) => [x._id, x.count]));
  res.json({
    success: true,
    data: {
      total: r.total[0]?.n || 0,
      openCritical: r.openCritical[0]?.n || 0,
      unverifiedSources: r.unverifiedSources[0]?.n || 0,
      byStatus: flat(r.byStatus),
      byCategory: flat(r.byCategory),
      bySeverity: flat(r.bySeverity),
      byChannel: flat(r.byChannel),
      byState: flat(r.byState),
      byLga: only ? flat(r.byLga) : {},
    },
  });
});

export { summary };
