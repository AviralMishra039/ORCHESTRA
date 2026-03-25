import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

const MAX_SCORES = {
  innovation: 25,
  technical: 25,
  business: 15,
  presentation: 15,
  clarity: 20
};

const ICONS = {
  innovation: '💡',
  technical: '⚙️',
  business: '📈',
  presentation: '🎤',
  clarity: '🎯'
};

function getConfidenceColor(tier) {
  if (tier === 'High') return 'bg-green-900/40 text-green-400 border-green-800';
  if (tier === 'Medium') return 'bg-amber-900/40 text-amber-400 border-amber-800';
  return 'bg-red-900/40 text-red-400 border-red-800';
}

export default function Feedback() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Override Form State
  const [overrideDim, setOverrideDim] = useState('innovation');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideJudge, setOverrideJudge] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState('');

  const fetchResult = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/results/${id}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [id]);

  const handleExportPDF = () => {
    if (!data || !data.feedback_report) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Orchestra Report: ${data.team_name}`, 15, 20);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(data.feedback_report.replace(/#/g, ''), 180);
    doc.text(lines, 15, 30);
    doc.save(`${data.team_name.replace(/\s+/g, '_')}_Orchestra_Report.pdf`);
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    setOverrideSuccess('');
    try {
      const res = await fetch(`http://localhost:8000/api/override/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimension: overrideDim,
          new_score: Number(overrideScore),
          reason: overrideReason,
          judge_name: overrideJudge
        })
      });
      const json = await res.json();
      if (json.success) {
        setOverrideSuccess('Override successfully applied! Recalculating scores...');
        setOverrideScore('');
        setOverrideReason('');
        await fetchResult();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center text-gray-400 mt-20">Loading Report...</div>;
  if (!data) return <div className="text-center text-red-400 mt-20">Report not found</div>;

  return (
    <div className="animate-fade-in pb-20">
      
      {/* Hero Section */}
      <div className="bg-orchestra-dark rounded-3xl p-8 mb-10 border border-gray-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight">{data.team_name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold uppercase tracking-widest">
            <span className={`px-4 py-1.5 rounded-full border ${getConfidenceColor(data.confidence_tier)}`}>
               Tier: {data.confidence_tier}
            </span>
            <span className="text-gray-500 bg-black/50 px-4 py-1.5 rounded-full border border-gray-800">
              {new Date(data.created_at).toLocaleString()}
            </span>
          </div>
          <div className="mt-8 flex gap-4">
            <button onClick={handleExportPDF} className="bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-xl font-bold transition-transform hover:scale-105 shadow-lg">
              📥 Export PDF
            </button>
            {data.prototype_url && (
              <a href={data.prototype_url} target="_blank" rel="noreferrer" className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/50 px-6 py-3 rounded-xl font-bold transition-colors">
                🔗 View Prototype
              </a>
            )}
          </div>
        </div>

        {/* Big Circular Score */}
        <div className="relative flex-shrink-0">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="552.9" strokeDashoffset={552.9 - (552.9 * data.total_score) / 100} className="text-orchestra-green drop-shadow-lg transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-white">{data.total_score}</span>
            <span className="text-gray-500 font-bold tracking-widest uppercase text-sm mt-1">/ 100</span>
          </div>
        </div>
      </div>

      {/* Auditor Section */}
      <div className="bg-black/50 border border-gray-800 rounded-2xl p-6 mb-10">
        <h3 className="text-lg font-bold text-white flex items-center mb-3">
          <span className="mr-2">🔎</span> Bias Auditor Notes
        </h3>
        <p className="text-gray-400 font-mono text-sm leading-relaxed whitespace-pre-wrap pl-7 border-l-2 border-gray-700 ml-2">
          {data.bias_flags?.length > 0 ? data.bias_flags.join('\n') : "All scores appear consistent and evidence-backed based on the automated analysis."}
        </p>
      </div>

      {/* Agents 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        {data.agent_outputs.map((agent) => {
          const pbPct = (agent.score / agent.max_score) * 100;
          return (
            <div key={agent.dimension} className="bg-orchestra-dark rounded-2xl border border-gray-800 overflow-hidden shadow-lg hover:border-gray-700 transition-colors">
              <div className="p-6 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white capitalize flex items-center gap-3">
                  <span className="text-2xl">{ICONS[agent.dimension]}</span> {agent.dimension}
                </h3>
                <div className="text-right">
                  <div className="text-2xl font-black text-orchestra-green leading-none">{agent.score} <span className="text-sm text-gray-500 font-normal">/ {agent.max_score}</span></div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-gray-900">
                <div className="h-full bg-orchestra-green" style={{ width: `${pbPct}%` }}></div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Evidence Found</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-300 space-y-2 font-mono">
                    {agent.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                  </ul>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3">Strengths</h4>
                    <ul className="space-y-2 text-sm text-green-100/70 list-inside">
                      {agent.strengths.map((s, i) => <li key={i} className="flex"><span className="mr-2 text-green-500">✓</span><span className="flex-1">{s}</span></li>)}
                    </ul>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">Improvements</h4>
                    <ul className="space-y-2 text-sm text-amber-100/70 list-inside">
                      {agent.improvements.map((im, i) => <li key={i} className="flex"><span className="mr-2 text-amber-500">→</span><span className="flex-1">{im}</span></li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Human Override Section */}
      <div className="bg-orchestra-dark rounded-2xl p-8 border border-gray-800 shadow-xl max-w-3xl">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
          <span className="mr-2">⚖️</span> Human Override
        </h2>
        <p className="text-gray-400 mb-6 font-medium">As a human judge, you can override any AI dimension score if you spot an error.</p>
        
        {overrideSuccess && <div className="mb-6 p-4 bg-orchestra-green/10 border border-orchestra-green/30 text-lime-400 rounded-lg text-sm font-bold">{overrideSuccess}</div>}

        <form onSubmit={handleOverride} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Dimension</label>
            <select 
              value={overrideDim} 
              onChange={e => setOverrideDim(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-orchestra-green focus:border-orchestra-green outline-none"
            >
              {Object.keys(MAX_SCORES).map(dim => <option key={dim} value={dim}>{dim.charAt(0).toUpperCase() + dim.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">New Score (Max {MAX_SCORES[overrideDim]})</label>
            <input 
              type="number" 
              required
              min="0"
              max={MAX_SCORES[overrideDim]}
              value={overrideScore}
              onChange={e => setOverrideScore(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-orchestra-green focus:border-orchestra-green outline-none" 
              placeholder={`Enter new score...`}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Reason for Override</label>
            <textarea 
              required
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white h-24 focus:ring-1 focus:ring-orchestra-green focus:border-orchestra-green outline-none resize-none" 
              placeholder="Why is the AI score being adjusted?"
            ></textarea>
          </div>
          <div className="md:col-span-2 flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Your Name</label>
              <input 
                type="text" 
                required
                value={overrideJudge}
                onChange={e => setOverrideJudge(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-orchestra-green focus:border-orchestra-green outline-none" 
                placeholder="Judge Signature"
              />
            </div>
            <button type="submit" className="bg-gray-100 hover:bg-white text-black font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105 whitespace-nowrap">
              Submit Override
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
