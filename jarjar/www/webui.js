$(function () {
	$.fn.simpleTabs = function (linkWrapper,cb,cb2) {
		var links = linkWrapper.find('a');
		return this.each(function () {
			var 	$this = $(this),
				$children = $this.children('.tab'),
					   id = location.hash.substr(1)+"-tab";
			
			$children.hide().filter('#'+id).show();
			if($children.filter(':visible').length < 1) {
				$children.eq(0).show();
			}
			else {
				cb2.apply(this, [location.hash.substr(1)]);
			}
			links.click(function () {
				$children.hide().filter('#'+this.id+"-tab").show();
				cb.apply(this, [$children]);
			});
		});
	};
	
	$('.tabs').simpleTabs($('#nav'), function ($children) {
		$(this).parents('ul').find('li').removeClass('active').end().end().parent().addClass('active');
	}, function (id) {
		$('#'+id).parents('ul').find('li').removeClass('active').end().end().parent().addClass('active');
	});

	$.hMod = {	
		username : "",
		host : {
			hostname: "",
			port: -1,
		},
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
		
		setUsername : function (v) {
			this.username = v;
		},
		setPassword : function (v) {
			this.password = v;
		},
		setSalt : function (v) {
			this.salt = v;
		},
		setFqn : function (v) {
			var matches = v.match(/(([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})|([a-zA-Z0-9-#;\.]+)):([0-9]+)/);
			if(matches.length == 5) {
				this.host.hostname = matches[3];
				this.host.port = parseInt(matches[4]);
			}
		},
		
		getHostUrl : function () {
			return "http://"+this.host.hostname + ":" + this.host.port;
		},
	
		boundCount : {},
		bind : function (n,c) {
			if(typeof(this.boundCount[n]) != "undefined") {
				this.boundCount[n] = 0;
			}
			this.boundCount[n]++;
			$('#hMod').bind(n,c);
		},
		trigger : function (n) {
			$('#hMod').trigger(n);
			return parseInt(this.boundCount[n]);
		},
		validateLogin : function (callback) {
			this.call({method: 'etc.getServer.getTime'}, callback);
		},
		makeAPIUrl : function (o) {
			var method = o.method,
				signature = o.signature || [],
				args = o.args || [];
			return this.getHostUrl()+sprintf(this._baseApiCallFormat, method, this._jsonE(signature), this._jsonE(args), this.makeKey(method));
		},
		makeAPIStreamUrl : function (o) {
			var method = typeof(o) == "object" ? o.method : o;
			return this.getHostUrl()+sprintf(this._baseApiCallFormat, method, this._jsonE(signature), this._jsonE(args), this.makeKey(method));
		},
		call : function (method, signature, args, callback) {
			var o = {};
			if(typeof(method) == "object") {
				o = method;
				callback = signature;
			}
			else {
				o = {
					'method' : method,
					'signature' : signature || [],
					'args' : args || [],
				};
			}
			var that = this;
			$.get(this.makeAPIUrl(o), function (json,status,jqXHR) {
				callback.apply($.hMod, [json, status, jqXHR]);
			}).error(function (jqXHR) {
				switch (jqXHR.status) {
					case 403:
						if(!that.trigger('hmod_403')) {
							alert('Invalid username, password or salt!');
						}
						break;
					case 500:
						if(!that.trigger('hmod_500')) {
							alert('Exception thrown!');
						}
						break;
					case 404:
						if(!that.trigger('hmod_404')) {					
							alert("WTF? 404? That shouldn't happen...");
						}
						break;
				}
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
		autoOpen: false,
		height: 435,
		width: 470,
		modal: true,
		buttons: {
			"Login": function() {
				_.map(["fqn", "username", "password", "salt"], function (v) {
					$.hMod["set"+v.charAt(0).toUpperCase()+v.slice(1)](document.getElementById(v).value);
				});
				var $that = $(this);
				$.hMod.validateLogin(function (e) {
					$that.dialog('close');
					$.hMod.trigger('hmod_ready');
				});
			}
		}
	});
	
	$.hMod.bind('hmod_ready', function () {
		alert("READY");
	});
	
	$('#progress-indicator')
		.ajaxStart(function () { $(this).fadeIn('fast'); })
		.ajaxStop(function () { $(this).fadeOut('fast'); });
});