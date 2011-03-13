$(function () {
	$.fn.simpleTabs = function (linkWrapper,oclass,cb,cb2,cb3) {
		var links = linkWrapper.find('a');
		return this.each(function () {
			var 	$this = $(this),
				$children = $this.children('.tab'),
					   id = location.hash.substr(1)+"-tab";
			
			$children.hide().filter('#'+id).show();
			if($children.filter(':visible').length < 1) {
				$children.eq(0).show();
				var a = $children.eq(0)[0];
				cb.apply($('#'+a.id.substring(0,a.id.length-4)), [$children]);
			}
			else {
				cb2.apply(this, [location.hash.substr(1)]);
			}
			links.click(function () {
				$children.hide().filter('#'+this.id+"-tab").show();
				cb.apply(this, [$children]);
			});
			oclass.live('click', function () {
				$children.hide().filter(this.href.substr(this.href.indexOf('#'))+"-tab").show();
				$(this.href.substr(this.href.indexOf('#'))).click();
				if(typeof(cb3) == "function") {
					cb3.apply(this, [$children]);
				}
			});
		});
	};
	
	$('.tabs').simpleTabs($('#nav'), $('.tab-link'), function ($children) {
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
		_baseApiMultiCallFormat : "/api/call-multiple?method=%s&signature=%s&args=%s&key=%s",
		_baseApiStreamFormat : "/api/subscribe?source=%s&key=%s",
		_cache : {},
		
		set : function (k,v) {
			if(typeof(k) == "object") {
				_.map(k, function (v,k) {
					$.hMod.set(k,v);
				});
				
				return;
			}
			this._cache[k] = v;
			return v;
		},
		
		get : function (k) {
			return this._cache[k];
		},
	
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
		getPlayers : function (c) {
			this.call({method:'etc.getServer.getPlayerList'}, c);
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
		makeAPIUrl : function (o,x) {
			var method = o.method,
				signature = o.signature || [],
				args = o.args || [];
			return (x ? "" : this.getHostUrl())+sprintf(this._baseApiCallFormat, encodeURIComponent(method), encodeURIComponent(this._jsonE(signature)), encodeURIComponent(this._jsonE(args)), this.makeKey(method));
		},
		makeAPIUrlMultiple : function (o,x) {
			var method = o.method,
				signature = o.signature || [],
				args = o.args || [];
			return (x ? "" : this.getHostUrl())+sprintf(this._baseApiMultiCallFormat, encodeURIComponent(this._jsonE(method)), encodeURIComponent(this._jsonE(signature)), encodeURIComponent(this._jsonE(args)), this.makeKey(this._jsonE(method)));
		},
		makeAPIStreamUrl : function (o,x) {
			var method = typeof(o) == "object" ? o.method : o;
			return (x ? "" : this.getHostUrl())+sprintf(this._baseApiStreamFormat, method, this.makeKey(method));
		},
		webSocketUrl : function () {
			return "ws://"+this.host.hostname + ":" + (this.host.port+1);
		},
		call : function (method, signature, args, callback) {
			if((typeof(method) == "object" && typeof(method.method) == "object") || typeof(method) == "array") {
				this.callMultiple(method, signature, args, callback);
				return;
			}
		
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
		callMultiple : function(methods, signatures, args, callback) {
			var o = {};
			if(typeof(methods) == "object") {
				o = methods;
				callback = signatures;
			}
			else {
				o = {
					'method' : methods,
					'signature' : signatures || [[]],
					'args' : args || [[]],
				};
			}
			var that = this;
			$.get(this.makeAPIUrlMultiple(o), function (json,status,jqXHR) {
				if(typeof(callback) == "object") {
					_.map(json.success, function (v,k) {
						callback[k].apply($.hMod, [v, status, jqXHR]);
					});
				}
				else {
					callback.apply($.hMod, [json, status, jqXHR]);
				}
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
			var socket = new WebSocket(this.webSocketUrl());

			var that = this;
			socket.onopen = function(evt) {
				socket.send(that.makeAPIStreamUrl(src, true));
			};

			socket.onerror = function(evt) {
				alert("error");
				alert(evt);
			};

			socket.onmessage = function(evt) {
				var data = JSON.parse(evt.data);
				if(data.result == "error") {
					socket.onerror(data.error);
				}
				else if(data.source == "console") {
					callbacks["message"](data["data"]);
				}
			};

			socket.onclose = function(evt) {
				alert('Closed.');
			};
			
			return socket;
		},
		makeKey : function (method) {
			return SHA256(this.username+method+this.password+this.salt);
		},
		
		playerLink : function (v) {
			return sprintf('<a href="#player-management" class="player-link tab-link" rel="%s">%s</a>', v, v);
		}
	};
	
	$("#login-form").dialog({
		autoOpen: true,
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
		// server status page
		(function () {
			var left = $('#status-left');
			var right = $('#status-right');
			
			left.html('<br class="clear" />');
			right.html('<br class="clear" />');
			
			var dl = {left:[], right:[]};
			
			this.call({
				method: [
					'etc.getInstance.getPlayerLimit',
					'etc.getServer.getPlayerList',
					'etc.getLoader.getPluginList',
					'etc.getInstance.getVersion',
					'etc.getInstance.getMotd'
				],
				args : [
					[],
					[],
					[],
					[],
					[],
					[]
				],
				signature : [
					[],
					[],
					[],
					[],
					[],
					[]
				]
			}, function (json) {
				var v = {
					player_limit : json.success[0].success,
					players : json.success[1].success,
					plugins : json.success[2].success,
					version : json.success[3].success,
					motd : json.success[4].success
				};
				
				dl.left.push(["Players",  v.players.length + '/' + v.player_limit]);
				dl.left.push(["Plugins", v.plugins]);
				dl.left.push(["Version", v.version]);
				dl.left.push(["MOTD", v.motd.join("<br/>")]);
				
				if(v.players.length == 0) {
					dl.right.push(["Player", "No players are online."]);
				}
				else {
					_.map(v.players, function (v) {
						dl.right.push(["Player", $.hMod.playerLink(v.name)]);
					});
				}
					
				this.set(v);
				
				_.map(dl.left.reverse(), function (v) {
					left.prepend(sprintf("<dt>%s</dt><dd>%s</dd>", v[0], v[1]));
				});
				
				_.map(dl.right.reverse(), function (v) {
					right.prepend(sprintf("<dt>%s</dt><dd>%s</dd>", v[0], v[1]));
				});
			});
			
			// this.getPlayers(function (json) {
				// var players = this.set('players', json.success);
				
				// this.call({method:'etc.getInstance.getPlayerLimit'}, function (jso2n) {
					// this.set('player_limit', jso2n.success);
					
					// dl.left.push(['Players', players.length.toString() + '/' + this.get('player_limit').toString()]);
					

				// });
			// });
		}).apply($.hMod);
		
		(function () {
			var console = $("#console");
			var input = $("#console-input");
			
			var appendToConsole = function (line) {
				if(typeof(line) == "object") {
					line = line["line"];
				}
				console.text($("#console").text()+line);
				console[0].scrollTop = console[0].scrollHeight + 25;
			};
			var socket = this.subscribe("console", {message: appendToConsole});
			
			var sendMessage = function (txt) {
				$.hMod.call({
					method:"etc.getServer.useConsoleCommand",
					signature: ["String"],
					args: [txt]
				}, function () {});
				appendToConsole(txt+"\n");
				input.val("");
			};
			
			$("#console-send").click(function () {
				sendMessage($("#console-input").val());
			});
			input.keydown(function (e) {
				if((e.keyCode? e.keyCode : e.charCode) == 13) {
					sendMessage($(this).val());
				}
			});
		}).apply($.hMod);
	});
	
	$('#progress-indicator')
		.ajaxStart(function () { $(this).fadeIn('fast'); })
		.ajaxStop(function () { $(this).fadeOut('fast'); });
});