'use strict';
'require view';
'require fs';
'require uci';
'require ui';
'require rpc';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('cloudflared'), {}).then(function(res) {
		var isRunning = false;
		try {
			isRunning = res['cloudflared']['instances']['cloudflared']['running'];
		} catch (ignored) {}
		return isRunning;
	});
}

function listTunnels() {
	return fs.stat('/etc/cloudflared/cert.pem').then(function(stat) {
		if (stat && stat.type === 'file') {
			return fs.exec('/usr/bin/cloudflared', ['tunnel', 'list', '-o', 'json']).then(function(res) {
				if (res.code === 0 && res.stdout && res.stdout.trim().startsWith('[')) {
					try {
						return JSON.parse(res.stdout);
					} catch (e) {
						return null;
					}
				}
				return null;
			}).catch(function() {
				return null;
			});
		}
		return null;
	}).catch(function() {
		return null;
	});
}

function parseToken(tokenStr) {
	if (!tokenStr || typeof tokenStr !== 'string') return null;
	try {
		var clean = tokenStr.trim().replace(/\s+/g, '');
		var decoded = atob(clean);
		return JSON.parse(decoded);
	} catch (e) {
		return null;
	}
}

function getLogConnections() {
	return fs.read('/var/log/cloudflared.log').then(function(res) {
		if (!res) return [];
		var conns = [];
		var lines = res.trim().split('\n');
		for (var i = lines.length - 1; i >= 0 && conns.length < 4; i--) {
			var l = lines[i];
			try {
				var obj = JSON.parse(l);
				if (obj.connIndex !== undefined || obj.connection || (obj.message && obj.message.indexOf('Registered tunnel connection') !== -1)) {
					conns.push({
						id: obj.connIndex !== undefined ? ('#' + obj.connIndex) : '-',
						ip: obj.ip || '-',
						location: obj.location || obj.colo_name || '-',
						protocol: obj.protocol || '-'
					});
				}
			} catch(e) {}
		}
		return conns;
	}).catch(function() {
		return [];
	});
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			listTunnels(),
			getServiceStatus(),
			uci.load('cloudflared').then(function() {
				return {
					enabled: uci.get('cloudflared', 'config', 'enabled'),
					token: uci.get('cloudflared', 'config', 'token')
				};
			}),
			getLogConnections()
		]);
	},

	render: function(data) {
		var tunnels = data[0];
		var isRunning = data[1];
		var uciConfig = data[2] || {};
		var logConns = data[3] || [];
		var tokenInfo = parseToken(uciConfig.token);

		// Case 1: Legacy mode with tunnels list from cloudflared tunnel list
		if (Array.isArray(tunnels) && tunnels.length > 0) {
			var tunnelRows = tunnels.map(function(tunnel, index) {
				var rowClass = index % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
				var tunneldate = new Date(tunnel.created_at).toLocaleString();
				return E('tr', { 'class': 'tr ' + rowClass }, [
					E('td', { 'class': 'td' }, tunnel.name),
					E('td', { 'class': 'td' }, tunnel.id),
					E('td', { 'class': 'td' }, tunneldate),
					E('td', { 'class': 'td' }, tunnel.connections ? tunnel.connections.length : 0)
				]);
			});

			var tunnelTable = [
				E('h3', _('Tunnels Information')),
				E('table', { 'class': 'table cbi-section-table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Name')),
						E('th', { 'class': 'th' }, _('ID')),
						E('th', { 'class': 'th' }, _('Created At')),
						E('th', { 'class': 'th' }, _('Connections'))
					]),
					E(tunnelRows)
				])
			];

			return E([],[
				E('h2', { 'class': 'section-title' }, _('Tunnels')),
				E('div', { 'class': 'cbi-section' }, tunnelTable)
			]);
		}

		// Case 2: Modern Cloudflare Zero Trust Token Mode
		if (uciConfig.token && uciConfig.token.trim() !== '') {
			var statusBadge = isRunning
				? E('span', { 'raw-html': true }, '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2ecc71;box-shadow:0 0 6px #2ecc71;margin-right:6px;vertical-align:middle;"></span><span style="color:#2ecc71;font-weight:600;vertical-align:middle;">' + _('Running') + '</span>')
				: E('span', { 'raw-html': true }, '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e74c3c;margin-right:6px;vertical-align:middle;"></span><span style="color:#e74c3c;font-weight:600;vertical-align:middle;">' + _('Not Running') + '</span>');

			var tunnelId = tokenInfo ? tokenInfo.t : _('Configured');
			var accountId = tokenInfo ? tokenInfo.a : '-';

			var connTable = null;
			if (logConns.length > 0) {
				connTable = E('table', { 'class': 'table cbi-section-table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Connection')),
						E('th', { 'class': 'th' }, _('Edge IP')),
						E('th', { 'class': 'th' }, _('Data Center')),
						E('th', { 'class': 'th' }, _('Protocol'))
					]),
					E(logConns.map(function(c, idx) {
						return E('tr', { 'class': 'tr ' + (idx % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2') }, [
							E('td', { 'class': 'td' }, c.id),
							E('td', { 'class': 'td' }, c.ip),
							E('td', { 'class': 'td' }, c.location),
							E('td', { 'class': 'td' }, c.protocol)
						]);
					}))
				]);
			}

			return E([], [
				E('h2', { 'class': 'section-title' }, _('Cloudflare Zero Trust Tunnel')),
				E('div', { 'class': 'cbi-section' }, [
					E('h3', _('Tunnel Information (Token Mode)')),
					E('div', { 'class': 'cbi-section-node' }, [
						E('table', { 'class': 'table' }, [
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td left', 'width': '33%' }, _('Service Status')),
								E('td', { 'class': 'td left' }, statusBadge)
							]),
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td left', 'width': '33%' }, _('Tunnel ID')),
								E('td', { 'class': 'td left' }, E('code', {}, tunnelId))
							]),
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td left', 'width': '33%' }, _('Account ID')),
								E('td', { 'class': 'td left' }, E('code', {}, accountId))
							]),
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td left', 'width': '33%' }, _('Management Mode')),
								E('td', { 'class': 'td left' }, _('Cloudflare Zero Trust Dashboard (Cloud-Managed)'))
							])
						])
					])
				]),
				connTable ? E('div', { 'class': 'cbi-section' }, [
					E('h3', _('Edge Connections')),
					E('div', { 'class': 'cbi-section-node' }, [ connTable ])
				]) : E('span'),
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-descr' }, [
						E('p', {}, _('In Token mode, all public hostnames, ingress rules, and zero-trust access policies are managed centrally in your Cloudflare dashboard.')),
						E('a', {
							'class': 'btn cbi-button cbi-button-apply',
							'href': 'https://one.dash.cloudflare.com/',
							'target': '_blank'
						}, _('Open Cloudflare Zero Trust Dashboard'))
					])
				])
			]);
		}

		// Case 3: Not configured yet
		return E([], [
			E('h2', { 'class': 'section-title' }, _('Cloudflare Zero Trust Tunnel')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('No Tunnel Configured')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('p', {}, _('No tunnel token has been configured yet. Please go to the Configuration tab, paste your Cloudflare Zero Trust Tunnel Token, and enable the service.')),
						E('a', {
							'class': 'btn cbi-button cbi-button-action',
							'href': L.url('admin/services/cloudflared/config')
						}, _('Go to Configuration'))
					])
				])
			])
		]);
	}
});
