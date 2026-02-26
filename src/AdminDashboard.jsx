import React, { useEffect, useMemo, useState } from 'react';

const ADMIN_TOKEN_STORAGE_KEY = 'sbs_admin_token';
const DEFAULT_APPS_SCRIPT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzvLzaUrInWabO28UyDN-IaOejbtUcjl-y7S-wcmefgIagqyDeOqjrlphNvFKMoW66ECA/exec';
const DEFAULT_GOOGLE_SHEET_ID = '1ui5NKrhdWafk8nxPBbqxqQonGYU1dAQuN-LZmQUmtSw';
const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || DEFAULT_GOOGLE_SHEET_ID;

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

const fetchSheetTabViaGviz = async (sheetId, tabName) => {
  const callbackName = `sbsGvizCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const gvizUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  gvizUrl.searchParams.set('sheet', tabName);
  gvizUrl.searchParams.set('headers', '1');
  gvizUrl.searchParams.set('tqx', `out:json;responseHandler:${callbackName}`);

  const payload = await requestViaJsonp(gvizUrl.toString());
  const table = payload?.table;
  if (!table?.cols || !table?.rows) return [];

  const headers = table.cols.map((col) => col.label || col.id || '');
  return table.rows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      const cell = row.c?.[idx];
      obj[header || `col_${idx}`] = cell?.f ?? cell?.v ?? '';
    });
    return obj;
  });
};

const AdminDashboard = () => {
  const endpoint =
    import.meta.env.VITE_ADMIN_DATA_ENDPOINT ||
    import.meta.env.VITE_JOIN_US_SHEET_WEBHOOK_URL ||
    DEFAULT_APPS_SCRIPT_ENDPOINT;
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [clientRows, setClientRows] = useState([]);
  const [teamRows, setTeamRows] = useState([]);

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
    const baseRows = activeTab === 'client'
      ? clientRows
      : activeTab === 'team'
        ? teamRows
        : allRows;

    if (!searchQuery.trim()) return baseRows;

    const needle = searchQuery.toLowerCase();
    return baseRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle))
    );
  }, [activeTab, clientRows, teamRows, allRows, searchQuery]);

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

    const sorted = [...keys].sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });

    return sorted;
  }, [filteredRows]);

  const fetchRows = async (accessToken) => {
    if (!endpoint) {
      setErrorMessage('Admin endpoint is missing. Set VITE_ADMIN_DATA_ENDPOINT.');
      return;
    }

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
    if (token) {
      fetchRows(token);
    }
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
              <h1 className="text-2xl font-semibold">Submissions</h1>
              <p className="text-sm text-zinc-600">Search and review Client + Team form entries.</p>
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

          <div className="mt-4 flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, role, budget..."
              className="w-full md:flex-1 border border-zinc-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('all')} className={`px-3 py-2 rounded-lg text-sm ${activeTab === 'all' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>All</button>
              <button onClick={() => setActiveTab('client')} className={`px-3 py-2 rounded-lg text-sm ${activeTab === 'client' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>Client</button>
              <button onClick={() => setActiveTab('team')} className={`px-3 py-2 rounded-lg text-sm ${activeTab === 'team' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'}`}>Team</button>
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
      </div>
    </div>
  );
};

export default AdminDashboard;
