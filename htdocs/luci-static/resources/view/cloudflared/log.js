'use strict';
'require fs';
'require ui';
'require view';
'require poll';

function formatLine(line) {
	if (!line || !line.trim()) return '';
	try {
		var obj = JSON.parse(line);
		var time = obj.time ? obj.time.replace('T', ' ').replace('Z', '') : '';
		var level = (obj.level || 'INFO').toUpperCase();
		var msg = obj.message || '';
		var extra = [];
		if (obj.connIndex !== undefined) extra.push('conn=' + obj.connIndex);
		if (obj.location) extra.push('location=' + obj.location);
		if (obj.ip) extra.push('ip=' + obj.ip);
		if (obj.protocol) extra.push('proto=' + obj.protocol);
		if (obj.error) extra.push('err=' + obj.error);
		var extraStr = extra.length ? ' (' + extra.join(', ') + ')' : '';
		return '[' + time + '] [' + level + '] ' + msg + extraStr;
	} catch(e) {
		return line;
	}
}

function fetchLogs(maxLines) {
	var limit = maxLines || 200;
	return fs.read('/var/log/cloudflared.log').catch(function() {
		return fs.read('/tmp/log/cloudflared.log');
	}).then(function(res) {
		if (!res || !res.trim()) return _('No log data available.');
		var rawLines = res.trim().split('\n');
		var recent = rawLines.slice(-limit);
		var formatted = recent.map(formatLine).filter(function(l) { return l.length > 0; });
		return formatted.join('\n');
	}).catch(function(err) {
		return _('Unable to read log file: ') + (err.message || err);
	});
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return fetchLogs(200);
	},

	render: function(initialLogs) {
		var isAutoScroll = true;

		var logArea = E('textarea', {
			'id': 'syslog',
			'class': 'cbi-input-textarea',
			'style': 'width: 100%; height: 520px; font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; padding: 10px; box-sizing: border-box; line-height: 1.5; white-space: pre; overflow-y: scroll;',
			'readonly': 'readonly',
			'wrap': 'off'
		}, [ initialLogs || '' ]);

		window.requestAnimationFrame(function() {
			logArea.value = initialLogs || '';
			logArea.scrollTop = logArea.scrollHeight;
		});

		// Track user scroll position
		logArea.addEventListener('scroll', function() {
			var isNearBottom = (logArea.scrollHeight - logArea.scrollTop - logArea.clientHeight <= 40);
			isAutoScroll = isNearBottom;
		});

		var lineSelect = E('select', { 'id': 'log-lines', 'style': 'margin-right: 8px;' }, [
			E('option', { 'value': '100' }, '100 ' + _('Lines')),
			E('option', { 'value': '200', 'selected': 'selected' }, '200 ' + _('Lines')),
			E('option', { 'value': '500' }, '500 ' + _('Lines'))
		]);

		var refreshBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'margin-right: 6px;',
			'click': function(ev) {
				var btn = ev.target;
				btn.disabled = true;
				var lines = parseInt(lineSelect.value, 10) || 200;
				fetchLogs(lines).then(function(content) {
					logArea.value = content;
					logArea.scrollTop = logArea.scrollHeight;
					isAutoScroll = true;
				}).finally(function() {
					btn.disabled = false;
				});
			}
		}, _('Refresh'));

		var clearBtn = E('button', {
			'class': 'btn cbi-button cbi-button-reset',
			'style': 'margin-right: 6px;',
			'click': function() {
				if (!confirm(_('Are you sure you want to clear the runtime log file?'))) return;
				fs.write('/var/log/cloudflared.log', '').catch(function() {
					return fs.write('/tmp/log/cloudflared.log', '');
				}).then(function() {
					logArea.value = _('No log data available.');
					ui.addNotification(null, E('p', {}, _('Log file cleared successfully.')), 'info');
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, _('Failed to clear log: ') + (err.message || err)), 'error');
				});
			}
		}, _('Clear Log'));

		var copyBtn = E('button', {
			'class': 'btn cbi-button',
			'style': 'margin-right: 6px;',
			'click': function() {
				navigator.clipboard.writeText(logArea.value).then(function() {
					ui.addNotification(null, E('p', {}, _('Log copied to clipboard!')), 'info');
				});
			}
		}, _('Copy'));

		var downloadBtn = E('button', {
			'class': 'btn cbi-button cbi-button-save',
			'click': function() {
				var blob = new Blob([logArea.value || ''], { type: 'text/plain;charset=utf-8' });
				var link = document.createElement('a');
				link.href = window.URL.createObjectURL(blob);
				link.download = 'cloudflared-' + (new Date().toISOString().slice(0,10)) + '.log';
				link.click();
			}
		}, _('Download Log'));

		// Polling update every 4s
		poll.add(function() {
			var lines = parseInt(lineSelect.value, 10) || 200;
			return fetchLogs(lines).then(function(content) {
				var el = document.getElementById('syslog');
				if (el) {
					el.value = content;
					if (isAutoScroll) {
						el.scrollTop = el.scrollHeight;
					}
				}
			});
		}, 4);

		return E([], [
			E('h2', { 'class': 'section-title' }, _('Cloudflare Tunnel - Runtime Log')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;' }, [
					E('div', { 'style': 'display: flex; align-items: center;' }, [
						E('label', { 'style': 'margin-right: 6px;' }, _('Display:')),
						lineSelect
					]),
					E('div', { 'style': 'display: flex; gap: 6px;' }, [
						refreshBtn,
						clearBtn,
						copyBtn,
						downloadBtn
					])
				]),
				E('div', { 'class': 'cbi-section-node' }, [
					logArea
				])
			])
		]);
	}
});
