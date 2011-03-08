(function ($) {
	$.hMod = {
		username : "",
		password : "",
		salt : "",
		_baseApiCallFormat : "/api/call?method=%s&signature=%s&args=%s&key=%s",
		_baseApiStreamFormat : "/api/subscribe?source=%s&key=%s",
	
		_jsonE : function (o) {
			return JSON.stringify(o);
		},
		_jsonD : function (str) {
			return JSON.parse(str);
		},
	
		bind : function (n,c) {
			$('#hMod').bind(n,c);
		},
		trigger : function (n) {
			$('#hMod').trigger(n);
		},
		validateLogin : function (callback) {
			this.call({method: 'getTime'}, callback);
		},
		makeAPIUrl : function (o) {
			var method = o.method,
				signature = o.signature || [],
				args = o.args || [];
			return sprintf(this._baseApiCallFormat, method, this._jsonE(signature), this._jsonE(args), this.makeKey(method));
		},
		makeAPIStreamUrl : function (o) {
			var method = typeof(o) == "object" ? o.method : o;
			return sprintf(this._baseApiCallFormat, method, this._jsonE(signature), this._jsonE(args), this.makeKey(method));
		},
		call : function (method, signature, args, callback) {
			var o = {};
			if(typeof(method) == "object") {
				o = method;
			}
			else {
				o = {
					'method' : method,
					'signature' : signature || [],
					'args' : args || [],
				};
			}
			$.get(this.makeAPIURL(o), function (json,status,jqXHR) {
				callback(this._jsonD(json), status,jqXHR);
			});
		},
		subscribe : function (src, callbacks) {
			// awesum timez websocketz here
		},
		makeKey : function (method) {
			return SHA256(this.username+method+this.password+this.salt);
		}
	};
	$("#login-form").dialog({
		autoOpen: true,
		height: 350,
		width: 400,
		modal: true,
		buttons: {
			"Login": function() {
				_map(["username", "password", "salt"], function (v) {
					$.hMod[v] = document.getElementById(v).value;
				});
				$.hMod.validateLogin(function (e)) {
					$.hMod.trigger('hmod_ready');
				});
			}
		},
		close: function() {
			allFields.val( "" ).removeClass( "ui-state-error" );
		}
	});
	$('#progress-indicator')
		.ajaxStart(function () { $(this).fadeIn('fast'); })
		.ajaxStop(function () { $(this).fadeOut('fast'); });
})(jQuery);