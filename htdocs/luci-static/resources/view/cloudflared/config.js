'use strict';
'require view';
'require form';
'require rpc';
'require fs';
'require ui';
'require poll';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

const callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

function renderStatusDot(isRunning) {
	if (isRunning) {
		return '<span style="color: #2ecc71; font-weight: bold;">●</span> ' + _('Running');
	} else {
		return '<span style="color: #e74c3c; font-weight: bold;">●</span> ' + _('Stopped');
	}
}

function getServiceData() {
	return L.resolveDefault(callServiceList('cloudflared'), {}).then(function(res) {
		var isRunning = false;
		var pid = null;
		try {
			var inst = res['cloudflared']['instances']['cloudflared'];
			isRunning = inst['running'] === true;
			pid = inst['pid'] || null;
		} catch (e) {}

		return fs.read('/var/log/cloudflared.log').then(function(logRes) {
			var locations = [];
			if (logRes) {
				var lines = logRes.trim().split('\n');
				for (var i = lines.length - 1; i >= 0 && locations.length < 4; i--) {
					try {
						var obj = JSON.parse(lines[i]);
						if (obj.location && locations.indexOf(obj.location) === -1) {
							locations.push(obj.location);
						}
					} catch(e) {}
				}
			}
			return {
				running: isRunning,
				pid: pid,
				locations: locations
			};
		}).catch(function() {
			return { running: isRunning, pid: pid, locations: [] };
		});
	});
}

function handleServiceAction(action, ev) {
	var btn = ev ? ev.target : null;
	if (btn) btn.disabled = true;

	var actMap = {
		'start': _('Starting'),
		'stop': _('Stopping'),
		'restart': _('Restarting')
	};

	ui.showIndicator('cloudflared-action', (actMap[action] || _('Operating')) + ' ' + _('Cloudflare Tunnel') + '...');

	return callInitAction('cloudflared', action).then(function() {
		ui.addNotification(null, E('p', {}, _('Service %s command issued successfully.').format(action)), 'info');
		return new Promise(function(resolve) { setTimeout(resolve, 1500); });
	}).then(function() {
		return getServiceData();
	}).then(function(st) {
		updateStatusDOM(st);
	}).catch(function(err) {
		ui.addNotification(null, E('p', {}, _('Failed to execute command: ') + (err.message || err)), 'error');
	}).finally(function() {
		ui.hideIndicator('cloudflared-action');
		if (btn) btn.disabled = false;
	});
}

function updateStatusDOM(st) {
	var badge = document.getElementById('cf_status_badge');
	var pidEl = document.getElementById('cf_pid_text');
	var locEl = document.getElementById('cf_loc_text');

	if (badge) {
		badge.innerHTML = renderStatusDot(st.running);
	}

	if (pidEl) {
		pidEl.textContent = st.running ? (st.pid ? String(st.pid) : '-') : '-';
	}

	if (locEl) {
		if (st.running && st.locations && st.locations.length > 0) {
			locEl.textContent = st.locations.join(', ');
		} else {
			locEl.textContent = st.running ? _('Connecting...') : '-';
		}
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			getServiceData(),
			fs.exec('/usr/bin/cloudflared', ['--version']).then(function(res) {
				if (res.code === 0 && res.stdout) {
					var match = res.stdout.match(/version\s+([^\s]+)/);
					return match ? match[1] : res.stdout.trim();
				}
				return _('Not Installed');
			}).catch(function() { return _('Not Installed'); })
		]);
	},

	render: function(data) {
		var serviceData = data[0] || { running: false, pid: null, locations: [] };
		var cfVersion = data[1] || _('Not Installed');

		var statusHtml = renderStatusDot(serviceData.running);

		var locationsStr = (serviceData.running && serviceData.locations && serviceData.locations.length > 0)
			? serviceData.locations.join(', ')
			: (serviceData.running ? _('Connecting...') : '-');

		var cfIconSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#f38020" style="vertical-align: middle; margin-right: 8px;"><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/></svg>';

		// Clean native LuCI status section
		var statusCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [
				E('span', { 'raw-html': true }, cfIconSvg),
				_('Service Status')
			]),
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Status')),
					E('div', { 'class': 'cbi-value-field', 'id': 'cf_status_badge' }, [
						E('span', { 'raw-html': true }, statusHtml)
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('PID')),
					E('div', { 'class': 'cbi-value-field', 'id': 'cf_pid_text' }, serviceData.running ? (serviceData.pid ? String(serviceData.pid) : '-') : '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Version')),
					E('div', { 'class': 'cbi-value-field' }, cfVersion)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Connected Edge')),
					E('div', { 'class': 'cbi-value-field', 'id': 'cf_loc_text' }, locationsStr)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Actions')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this, function(ev) { return handleServiceAction('start', ev); })
						}, _('Start')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-reset',
							'click': ui.createHandlerFn(this, function(ev) { return handleServiceAction('stop', ev); })
						}, _('Stop')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': ui.createHandlerFn(this, function(ev) { return handleServiceAction('restart', ev); })
						}, _('Restart'))
					])
				])
			])
		]);

		// Setup polling
		poll.add(function() {
			return getServiceData().then(function(st) {
				updateStatusDOM(st);
			});
		}, 4);

		var m, s, o;

		m = new form.Map('cloudflared', _('Cloudflare Zero Trust Tunnel'));

		s = m.section(form.NamedSection, 'config', 'cloudflared', _('Configuration'));

		// 1. Enable Switch
		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;
		o.default = '0';

		// 2. Mode Selector
		o = s.option(form.ListValue, 'mode', _('Operation Mode'), _('Select the management mode. Cloud-managed Token mode is recommended for most setups.'));
		o.value('token', _('Token Mode (Cloud-Managed, Recommended)'));
		o.value('local', _('Local Config Mode (Advanced)'));
		o.default = 'token';
		o.rmempty = false;

		// 3. Token (password masked with eye icon)
		o = s.option(form.Value, 'token', _('Tunnel Token'),
			_('Paste the tunnel token generated from Cloudflare Zero Trust (Networks > Tunnels).')
		);
		o.depends('mode', 'token');
		o.password = true;
		o.monospace = true;
		o.placeholder = 'eyJh...';
		o.rmempty = true;
		o.validate = function(section_id, value) {
			var enabled = this.section.formvalue(section_id, 'enabled');
			var mode = this.section.formvalue(section_id, 'mode') || 'token';
			if (enabled === '1' && mode === 'token' && (!value || value.trim() === '')) {
				return _('Tunnel Token is required when service is enabled in Token mode.');
			}
			return true;
		};

		// 4. Protocol Selector
		o = s.option(form.ListValue, 'protocol', _('Transport Protocol'), _('Protocol used to connect to Cloudflare edge. HTTP/2 is recommended for highest stability against UDP filtering.'));
		o.value('http2', _('HTTP/2 (TCP 443, Recommended)'));
		o.value('auto', _('Auto'));
		o.value('quic', _('QUIC (UDP 7844)'));
		o.default = 'http2';
		o.rmempty = false;

		// 5. Log Level
		o = s.option(form.ListValue, 'loglevel', _('Log Level'));
		o.value('info', 'Info');
		o.value('warn', 'Warning');
		o.value('error', 'Error');
		o.value('debug', 'Debug');
		o.default = 'info';

		// 6. Advanced Local Mode Options (Only visible when mode == 'local')
		o = s.option(form.Value, 'config', _('Config File Path'));
		o.depends('mode', 'local');
		o.placeholder = '/etc/cloudflared/config.yml';
		o.rmempty = true;

		o = s.option(form.Value, 'origincert', _('Origin Certificate Path'));
		o.depends('mode', 'local');
		o.placeholder = '/etc/cloudflared/cert.pem';
		o.rmempty = true;

		return m.render().then(function(mapNode) {
			return E('div', { 'class': 'cbi-map' }, [
				statusCard,
				mapNode
			]);
		});
	}
});
