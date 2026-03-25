import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const MAX_SCORES = {
  innovation: 25,
  technical: 25,
  business: 15,
  presentation: 15,
  clarity: 20
};

function getScoreColor(score, max) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'bg-green-900/40 text-green-400 border-green-800';
  if (pct >= 60) return 'bg-amber-900/40 text-amber-400 border-amber-800';
  return 'bg-red-900/40 text-red-400 border-red-800';
}

function getConfidenceColor(tier) {
  if (tier === 'High') return 'bg-green-900/40 text-green-400 border-green-800';
  if (tier === 'Medium') return 'bg-amber-900/40 text-amber-400 border-amber-800';
  return 'bg-red-900/40 text-red-400 border-red-800';
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, lbRes] = await Promise.all([
        fetch('http://localhost:8000/api/stats'),
        fetch('http://localhost:8000/api/leaderboard')
      ]);
      const statsData = await statsRes.json();
      const lbData = await lbRes.json();
      if (statsData.success) setStats(statsData.data);
      if (lbData.success) setLeaderboard(lbData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="text-center text-gray-400 mt-20">Loading Dashboard...</div>;
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-orchestra-dark rounded-2xl p-6 border border-gray-800 shadow-lg">
          <div className="text-gray-400 text-sm mb-1 font-medium tracking-widest uppercase">Total Teams</div>
          <div className="text-4xl font-bold text-white">{stats?.total_submissions || 0}</div>
        </div>
        <div className="bg-orchestra-dark rounded-2xl p-6 border border-gray-800 shadow-lg">
          <div className="text-gray-400 text-sm mb-1 font-medium tracking-widest uppercase">Avg Score</div>
          <div className="text-4xl font-bold text-white">{(stats?.average_score || 0).toFixed(1)} <span className="text-xl text-gray-600 font-normal">/ 100</span></div>
        </div>
        <div className="bg-orchestra-dark rounded-2xl p-6 border border-gray-800 shadow-lg flex flex-col justify-center">
          <div className="text-gray-400 text-sm mb-1 font-medium tracking-widest uppercase">Highest Score</div>
          <div className="text-4xl font-bold text-white">{stats?.top_team ? stats.top_team.total_score : 0} <span className="text-xl text-gray-600 font-normal">/ 100</span></div>
        </div>
        <div className="bg-orchestra-dark rounded-2xl p-6 border border-orchestra-green/30 shadow-lg shadow-orchestra-green/5">
          <div className="text-orchestra-green text-sm mb-1 font-medium tracking-widest uppercase">Top Team</div>
          <div className="text-2xl font-bold text-white truncate mt-1">{stats?.top_team ? stats.top_team.team_name : '-'}</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-orchestra-dark rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-black/40">
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="mr-2">🏆</span> Live Leaderboard
          </h2>
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 bg-black px-3 py-1.5 rounded-full border border-gray-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orchestra-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orchestra-green"></span>
            </span>
            <span>Live Sync</span>
          </div>
        </div>
        
        {leaderboard.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-6xl mb-6 opacity-50">📊</div>
            <h3 className="text-2xl text-white font-semibold mb-3">No submissions yet</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">Upload the first hackathon project to see the AI panel evaluate and rank it in real-time.</p>
            <Link to="/submit" className="bg-orchestra-green hover:bg-lime-400 text-black font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105 inline-block">
              Submit Project
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-black/60 text-gray-500 text-xs uppercase tracking-widest font-semibold border-b border-gray-800">
                  <th className="py-5 px-6">Rank</th>
                  <th className="py-5 px-6 w-1/4">Team</th>
                  <th className="py-5 px-6">Total Score</th>
                  <th className="py-5 px-6">Dimensions</th>
                  <th className="py-5 px-6">Confidence</th>
                  <th className="py-5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {leaderboard.map((row) => (
                  <tr key={row.submission_id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-5 px-6">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${row.rank === 1 ? 'bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50' : row.rank === 2 ? 'bg-gray-300/20 text-gray-300 ring-1 ring-gray-400/50' : row.rank === 3 ? 'bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/50' : 'text-gray-500'}`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="font-bold text-white text-xl mb-1">{row.team_name}</div>
                      {row.prototype_url && (
                        <a href={row.prototype_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center w-fit">
                          <span className="mr-1">🔗</span> Prototype
                        </a>
                      )}
                    </td>
                    <td className="py-5 px-6">
                      <div className="text-3xl font-extrabold text-white">
                        {row.total_score}
                        <span className="text-sm text-gray-600 font-normal ml-1">/100</span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex flex-wrap gap-2 max-w-sm">
                        {Object.entries(row.dimension_scores).map(([dim, score]) => (
                          <span key={dim} title={dim} className={`px-2.5 py-1.5 rounded text-[10px] sm:text-xs border uppercase tracking-wider font-bold ${getScoreColor(score, MAX_SCORES[dim] || 25)}`}>
                            {dim.substring(0,3)} {score}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`px-4 py-1.5 rounded-full text-xs border font-bold uppercase tracking-widest ${getConfidenceColor(row.confidence_tier)}`}>
                        {row.confidence_tier}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <Link to={`/feedback/${row.submission_id}`} className="inline-block bg-white/5 hover:bg-white/10 border border-gray-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-all group-hover:border-orchestra-green group-hover:text-orchestra-green">
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
