import React, { useEffect, useMemo, useState } from 'react';

const ADMIN_TOKEN_STORAGE_KEY = 'sbs_admin_token';
const DEFAULT_APPS_SCRIPT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzvLzaUrInWabO28UyDN-IaOejbtUcjl-y7S-wcmefgIagqyDeOqjrlphNvFKMoW66ECA/exec';
const DEFAULT_GOOGLE_SHEET_ID = '1ui5NKrhdWafk8nxPBbqxqQonGYU1dAQuN-LZmQUmtSw';
const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || DEFAULT_GOOGLE_SHEET_ID;

const GAME_ROLES = ['Raja', 'Mantri', 'Chor', 'Sipahi'];
const DEFAULT_ROLE_POINTS = {
  Raja: 1000,
  Mantri: 700,
  Sipahi: 500,
  Chor: 0,
  Janta: 250
};

const normalizeRows = (payload, fallbackType) => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    if (!payload.length) return [];

    if (typeof payload[0] === 'object' && !Array.isArray(payload[0])) {
      return payload.map((row) => ({ ...row, form_type: row.form_type || fallbackType }));
    }

    if (Array.isArray(payload[0])) {
      const [headerRow, ...dataRows] = payload;
      const headers = headerRow.map((header) => String(header || '').trim());
      return dataRows.map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (!header) return;
          obj[header] = row[index] ?? '';
        });
        obj.form_type = obj.form_type || fallbackType;
        return obj;
      });
    }
  }

  if (payload.headers && Array.isArray(payload.rows)) {
    const headers = payload.headers.map((header) => String(header || '').trim());
    return payload.rows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        obj[header] = row[index] ?? '';
      });
      obj.form_type = obj.form_type || fallbackType;
      return obj;
    });
  }

  return [];
};

const buildRequestUrl = (baseUrl, token) => {
  const url = new URL(baseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('format', 'json');
  return url.toString();
};

const requestViaJsonp = (baseUrl, params = {}) =>
  new Promise((resolve, reject) => {
    const callbackName = `sbsAdminCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    url.searchParams.set('callback', callbackName);

    let timeoutId = null;
    const script = document.createElement('script');

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to fetch admin data.'));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Admin request timed out.'));
    }, 12000);

    script.src = url.toString();
    document.body.appendChild(script);
  });

const fetchSheetTabViaGviz = (sheetId, tabName) =>
  new Promise((resolve, reject) => {
    const callbackName = `sbsGvizCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const gvizUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
    gvizUrl.searchParams.set('sheet', tabName);
    gvizUrl.searchParams.set('headers', '1');
    gvizUrl.searchParams.set('tqx', `out:json;responseHandler:${callbackName}`);

    let timeoutId = null;
    const script = document.createElement('script');

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };

    window[callbackName] = (payload) => {
      cleanup();
      const table = payload?.table;
      if (!table?.cols || !table?.rows) {
        resolve([]);
        return;
      }

      const headers = table.cols.map((col) => col.label || col.id || '');
      const rows = table.rows.map((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          const cell = row.c?.[idx];
          obj[header || `col_${idx}`] = cell?.f ?? cell?.v ?? '';
        });
        return obj;
      });
      resolve(rows);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to fetch admin data.'));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Admin request timed out.'));
    }, 12000);

    script.src = gvizUrl.toString();
    document.body.appendChild(script);
  });

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normalizePlayersInput = (value) => {
  const raw = value
    .split(/\n|,|;/)
    .map((name) => name.trim())
    .filter(Boolean);

  const unique = [];
  raw.forEach((name) => {
    if (!unique.some((entry) => entry.toLowerCase() === name.toLowerCase())) unique.push(name);
  });

  return unique.slice(0, 10);
};

const AdminDashboard = () => {
  const endpoint =
    import.meta.env.VITE_ADMIN_DATA_ENDPOINT ||
    import.meta.env.VITE_JOIN_US_SHEET_WEBHOOK_URL ||
    DEFAULT_APPS_SCRIPT_ENDPOINT;

  const [panel, setPanel] = useState('submissions');
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  const [submissionsTab, setSubmissionsTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [clientRows, setClientRows] = useState([]);
  const [teamRows, setTeamRows] = useState([]);

  const [playersInput, setPlayersInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [rolePoints, setRolePoints] = useState(DEFAULT_ROLE_POINTS);
  const [gameError, setGameError] = useState('');
  const [currentRound, setCurrentRound] = useState(null);
  const [rolesRevealed, setRolesRevealed] = useState(false);
  const [roundLedger, setRoundLedger] = useState([]);

  const allRows = useMemo(() => {
    const merged = [
      ...clientRows.map((row) => ({ ...row, form_type: row.form_type || 'client' })),
      ...teamRows.map((row) => ({ ...row, form_type: row.form_type || 'team' }))
    ];

    return merged.sort((a, b) => {
      const aTime = new Date(a['Submitted At'] || a.submitted_at || a.timestamp || 0).getTime();
      const bTime = new Date(b['Submitted At'] || b.submitted_at || b.timestamp || 0).getTime();
      return bTime - aTime;
    });
  }, [clientRows, teamRows]);

  const filteredRows = useMemo(() => {
    const baseRows = submissionsTab === 'client'
      ? clientRows
      : submissionsTab === 'team'
        ? teamRows
        : allRows;

    if (!searchQuery.trim()) return baseRows;

    const needle = searchQuery.toLowerCase();
    return baseRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle))
    );
  }, [submissionsTab, clientRows, teamRows, allRows, searchQuery]);

  const visibleColumns = useMemo(() => {
    const keys = new Set();
    filteredRows.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });

    const preferredOrder = [
      'Submitted At',
      'submitted_at',
      'form_type',
      'Name',
      'name',
      'Email',
      'email',
      'Phone',
      'phone'
    ];

    return [...keys].sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
  }, [filteredRows]);

  const totalsByPlayer = useMemo(() => {
    const seed = {};
    players.forEach((name) => {
      seed[name] = 0;
    });

    roundLedger.forEach((round) => {
      round.assignments.forEach((entry) => {
        seed[entry.name] = (seed[entry.name] || 0) + entry.points;
      });
    });

    return seed;
  }, [players, roundLedger]);

  const leaderboard = useMemo(() => {
    return Object.entries(totalsByPlayer)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [totalsByPlayer]);

  const ledgerRows = useMemo(() => {
    return roundLedger.flatMap((round) =>
      round.assignments.map((assignment) => ({
        round: round.round,
        timestamp: round.timestamp,
        ...assignment
      }))
    );
  }, [roundLedger]);

  const fetchRows = async (accessToken) => {
    if (!accessToken) {
      setErrorMessage('Enter access token to continue.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (GOOGLE_SHEET_ID) {
        const [directClientRows, directTeamRows] = await Promise.all([
          fetchSheetTabViaGviz(GOOGLE_SHEET_ID, 'ClientFormData'),
          fetchSheetTabViaGviz(GOOGLE_SHEET_ID, 'TeamFormData')
        ]);
        setClientRows(directClientRows.map((row) => ({ ...row, form_type: 'client' })));
        setTeamRows(directTeamRows.map((row) => ({ ...row, form_type: 'team' })));
      } else {
        const requestUrl = buildRequestUrl(endpoint, accessToken);
        const data = await requestViaJsonp(requestUrl);

        const normalizedClientRows = normalizeRows(
          data.clientRows || data.client || data.client_form_data || data.ClientFormData,
          'client'
        );
        const normalizedTeamRows = normalizeRows(
          data.teamRows || data.team || data.team_form_data || data.TeamFormData,
          'team'
        );

        if (!normalizedClientRows.length && !normalizedTeamRows.length && Array.isArray(data.rows)) {
          const flattened = normalizeRows(data.rows, 'all');
          setClientRows(flattened.filter((row) => String(row.form_type || '').toLowerCase().includes('client')));
          setTeamRows(flattened.filter((row) => String(row.form_type || '').toLowerCase().includes('team')));
        } else {
          setClientRows(normalizedClientRows);
          setTeamRows(normalizedTeamRows);
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchRows(token);
  }, [token]);

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMessage('Enter access token to continue.');
      return;
    }

    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, cleanToken);
    setToken(cleanToken);
    setTokenInput('');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken('');
    setClientRows([]);
    setTeamRows([]);
    setSearchQuery('');
    setErrorMessage('');
  };

  const handleLoadPlayers = () => {
    const normalized = normalizePlayersInput(playersInput);
    if (normalized.length < 4 || normalized.length > 10) {
      setGameError('Enter between 4 and 10 unique player names.');
      return;
    }

    setPlayers(normalized);
    setGameError('');
    setCurrentRound(null);
    setRolesRevealed(false);
    setRoundLedger([]);
  };

  const drawRandomRound = () => {
    if (players.length < 4) {
      setGameError('Load at least 4 players first.');
      return;
    }

    const shuffledPlayers = shuffle(players);
    const shuffledRoles = shuffle(GAME_ROLES);
    const assignments = [];

    shuffledPlayers.forEach((name, index) => {
      const role = index < 4 ? shuffledRoles[index] : 'Janta';
      assignments.push({
        name,
        role,
        points: Number(rolePoints[role] || 0)
      });
    });

    setCurrentRound({
      round: roundLedger.length + 1,
      assignments
    });
    setRolesRevealed(false);
    setGameError('');
  };

  const saveRoundToLedger = () => {
    if (!currentRound) {
      setGameError('Draw a round first.');
      return;
    }

    setRoundLedger((prev) => [
      ...prev,
      {
        round: currentRound.round,
        timestamp: new Date().toISOString(),
        assignments: currentRound.assignments
      }
    ]);
    setCurrentRound(null);
    setRolesRevealed(false);
    setGameError('');
  };

  const resetGame = () => {
    setCurrentRound(null);
    setRolesRevealed(false);
    setRoundLedger([]);
    setGameError('');
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-100 text-zinc-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-8 shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
          <p className="text-zinc-600 text-sm mb-6">Enter your admin access token.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Access token"
              className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <button
              type="submit"
              className="w-full bg-zinc-900 text-white py-3 rounded-lg font-semibold hover:bg-zinc-800 transition-colors"
            >
              Continue
            </button>
          </form>
          {errorMessage && <p className="text-red-600 text-sm mt-4">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Admin Control Center</h1>
              <p className="text-sm text-zinc-600">Manage submissions and run the live game console.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchRows(token)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-semibold hover:bg-zinc-50"
              >
                Log out
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPanel('submissions')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${panel === 'submissions' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 hover:bg-zinc-50'}`}
            >
              Submissions
            </button>
            <button
              onClick={() => setPanel('game')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${panel === 'game' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 hover:bg-zinc-50'}`}
            >
              Raja Mantri Chor Sipahi
            </button>
          </div>
        </div>

        {panel === 'submissions' && (
          <>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
              <div className="mt-1 flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, role, budget..."
                  className="w-full md:flex-1 border border-zinc-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <div className="flex gap-2">
                  <button onClick={() => setSubmissionsTab('all')} className={`px-3 py-2 rounded-lg text-sm ${submissionsTab === 'all' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>All</button>
                  <button onClick={() => setSubmissionsTab('client')} className={`px-3 py-2 rounded-lg text-sm ${submissionsTab === 'client' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>Client</button>
                  <button onClick={() => setSubmissionsTab('team')} className={`px-3 py-2 rounded-lg text-sm ${submissionsTab === 'team' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>Team</button>
                </div>
              </div>
              {errorMessage && <p className="text-red-600 text-sm mt-3">{errorMessage}</p>}
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={column} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(visibleColumns.length, 1)} className="px-4 py-8 text-center text-zinc-500">
                          {loading ? 'Loading data...' : 'No submissions found.'}
                        </td>
                      </tr>
                    )}
                    {filteredRows.map((row, index) => (
                      <tr key={`${row.email || 'row'}-${index}`} className="border-b border-zinc-100">
                        {visibleColumns.map((column) => (
                          <td key={`${column}-${index}`} className="px-4 py-3 align-top max-w-[320px] break-words">
                            {String(row[column] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {panel === 'game' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
                <h2 className="text-xl font-semibold mb-1">Game Setup</h2>
                <p className="text-sm text-zinc-600 mb-4">Enter 4 to 10 contestant names. One Raja, one Mantri, one Chor, one Sipahi are assigned every round. Others are Janta.</p>
                <textarea
                  value={playersInput}
                  onChange={(e) => setPlayersInput(e.target.value)}
                  rows={5}
                  placeholder="Enter names (one per line or comma-separated)"
                  className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={handleLoadPlayers} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">Load Players</button>
                  <button onClick={drawRandomRound} className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-semibold hover:bg-zinc-50">Draw Random Roles</button>
                  <button onClick={() => setRolesRevealed((prev) => !prev)} className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-semibold hover:bg-zinc-50">
                    {rolesRevealed ? 'Hide Roles' : 'Reveal Roles'}
                  </button>
                  <button onClick={saveRoundToLedger} className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-semibold hover:bg-zinc-50">Save Round to Ledger</button>
                  <button onClick={resetGame} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50">Reset Game</button>
                </div>
                {gameError && <p className="text-red-600 text-sm mt-3">{gameError}</p>}
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-3">Role Points</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.keys(rolePoints).map((role) => (
                    <label key={role} className="text-sm">
                      <span className="block text-zinc-600 mb-1">{role}</span>
                      <input
                        type="number"
                        value={rolePoints[role]}
                        onChange={(e) => setRolePoints((prev) => ({ ...prev, [role]: Number(e.target.value || 0) }))}
                        className="w-full border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Current Round</h3>
                  <p className="text-sm text-zinc-500">{currentRound ? `Round ${currentRound.round}` : 'No active round'}</p>
                </div>
                {!currentRound && <p className="text-sm text-zinc-500">Draw random roles to start a new round.</p>}
                {currentRound && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentRound.assignments.map((entry) => (
                      <div key={entry.name} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50">
                        <p className="text-sm text-zinc-500">Contestant</p>
                        <p className="font-semibold text-zinc-900">{entry.name}</p>
                        <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">Role</p>
                        <p className="text-sm font-semibold">{rolesRevealed ? entry.role : 'Hidden'}</p>
                        <p className="text-xs text-zinc-500 mt-1">Points: {rolesRevealed ? entry.points : '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-3">Leaderboard</h3>
                {leaderboard.length === 0 && <p className="text-sm text-zinc-500">No scores yet.</p>}
                {leaderboard.length > 0 && (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between border border-zinc-200 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs text-zinc-500">#{index + 1}</p>
                          <p className="font-semibold">{entry.name}</p>
                        </div>
                        <p className="text-lg font-bold">{entry.points}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-3">Round Ledger</h3>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2">Round</th>
                        <th className="text-left px-2 py-2">Name</th>
                        <th className="text-left px-2 py-2">Role</th>
                        <th className="text-right px-2 py-2">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRows.length === 0 && (
                        <tr>
                          <td className="px-2 py-3 text-zinc-500" colSpan={4}>No rounds saved yet.</td>
                        </tr>
                      )}
                      {ledgerRows.map((row, idx) => (
                        <tr key={`${row.round}-${row.name}-${idx}`} className="border-t border-zinc-100">
                          <td className="px-2 py-2">{row.round}</td>
                          <td className="px-2 py-2">{row.name}</td>
                          <td className="px-2 py-2">{row.role}</td>
                          <td className="px-2 py-2 text-right font-semibold">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
