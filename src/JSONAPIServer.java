


import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Properties;
import java.util.StringTokenizer;
import java.util.logging.Logger;
import net.hey0.hMod.Base64Coder;
import net.hey0.hMod.HttpStream;
import net.hey0.hMod.NanoHTTPD;

import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;


public class JSONAPIServer extends NanoHTTPD {
	Hashtable<String, String> logins = new Hashtable<String, String>();
	Logger outLog = Logger.getLogger("Minecraft");
	Listener l = new Listener();

	public JSONAPIServer(Hashtable<String,String> authTable, int port) throws IOException {
		super(port);
		logins = authTable;

		etc.getLoader().addListener( PluginLoader.Hook.CHAT, l, null, PluginListener.Priority.CRITICAL);
		etc.getLoader().addListener( PluginLoader.Hook.COMMAND, l, null, PluginListener.Priority.CRITICAL);
		etc.getLoader().addListener( PluginLoader.Hook.DISCONNECT, l, null, PluginListener.Priority.CRITICAL);
		etc.getLoader().addListener( PluginLoader.Hook.LOGIN, l, null, PluginListener.Priority.CRITICAL);

		info("WebUI Server: Running. ("+authTable.size()+" available username & password combinations)");
	}

	public Object callMethod(String method, String[] signature, Object[] params) throws Exception {
		String[] parts = method.split("\\.");
		String className = parts[0];
		String methodName = null;
		String parentMethodName = null;
		if(parts.length > 2) {
			methodName = parts[2];
			parentMethodName = parts[1];
		}
		else {
			methodName = parts[1];
		}
		Class c = Class.forName(parts[0]);
		Object inst = null;

		if(parentMethodName != null) {
			inst = c.getMethod(parentMethodName, null).invoke(null, null);
			c = inst.getClass();
		}

		Class<?>[] ps = new Class<?>[signature.length];
		for(int i = 0; i< signature.length; i++) {
			try {
				ps[i] = Class.forName(signature[i]);
			}
			catch(ClassNotFoundException e) {
				ps[i] = Class.forName("java.lang."+signature[i]);
			}
		}

		return c.getMethod(methodName, ps).invoke(parentMethodName != null ? inst : null, params);

	}

	public boolean testLogin (String method, String hash) {
		try {
			boolean valid = false;

			Enumeration<String> e = logins.keys();

			while(e.hasMoreElements()) {
				String user = e.nextElement();
				String pass = logins.get(user);

				String thishash = etc.SHA256(user+method+pass+etc.getInstance().getWebUiSalt());
				if(thishash.equals(hash)) {
					valid = true;
					break;
				}
			}

			return valid;
		}
		catch (Exception e) {
			return false;
		}
	}

	public static String callback (String callback, String json) {
		if(callback == null) return json;
		return callback.concat("(").concat(json).concat(")");
	}

	public void info (String log) {
		if(etc.getInstance().getWebUiShouldLog()) {
			outLog . info(log);
		}
	}

	@Override
	public Response serve( String uri, String method, Properties header, Properties parms )	{
		String callback = parms.getProperty("callback");

		if(uri.equals("/api/subscribe")) {
			String source = parms.getProperty("source");
			String key = parms.getProperty("key");

			if(!testLogin(source, key)) {
				JSONObject r = new JSONObject();
				r.put("result", "error");
				r.put("error", "Invalid username/password.");
				return new NanoHTTPD.Response(HTTP_FORBIDDEN, MIME_JSON, callback(callback, r.toJSONString()));
			}

			info("[Streaming API] "+header.get("X-REMOTE-ADDR")+": source="+ source);

			try {
				if(source == null)
					throw new Exception();

				boolean toAdd = false;
				if(HttpStream.handler == null) {
					toAdd = true;
				}

				// HttpStream.handler will now be non-null
				HttpStream out = new HttpStream(source, callback);

				if(toAdd) {
					etc.getInstance().stdout.addHander(HttpStream.handler);
					etc.getInstance().stderr.addHander(HttpStream.handler);
				}

				return new NanoHTTPD.Response( HTTP_OK, MIME_PLAINTEXT, out);
			} catch (Exception e) {
				e.printStackTrace();
				JSONObject r = new JSONObject();
				r.put("result", "error");
				r.put("error", "That source doesn't exist!");
				return new NanoHTTPD.Response( HTTP_NOTFOUND, MIME_JSON, callback(callback, r.toJSONString()));
			}
		}

		if(!uri.equals("/api/call")) {
			boolean valid = false;

			// use basic authentication for other file access
			// not the most secure but whatever...
			// IMPORTANT all headers are lowercase
			String authHeader = header.getProperty("authorization");

			if (authHeader != null && !authHeader.equals("")) {
				try {
					StringTokenizer st = new StringTokenizer(authHeader);
					if (st.hasMoreTokens()) {
						String basic = st.nextToken();

						// We only handle HTTP Basic authentication
						if (basic.equalsIgnoreCase("Basic")) {
							String credentials = st.nextToken();
							String userPass = new String(Base64Coder.decode(credentials));

							// The decoded string is in the form
							// "userID:password".
							int p = userPass.indexOf(":");
							if (p != -1) {
								String authU = userPass.substring(0, p).trim();
								String authP = userPass.substring(p + 1).trim();

								try {
									if(logins.get(authU).equals(authP)) {
										valid = true;
									}
								} catch (Exception e) {
									valid = false;
								}
							}
						}
					}
				} catch(Exception e) {
					e.printStackTrace();
				}
			}

			if(!valid) {
				NanoHTTPD.Response r = new NanoHTTPD.Response(HTTP_UNAUTHORIZED, MIME_PLAINTEXT, "Use a WebUI username & password combination.");
				r.addHeader("WWW-Authenticate", "Basic realm=\"hMod Server Login\"");
				return r;
			}

			info("[WebUI] Serving file: "+uri);

			return serveFile(uri, header, new File("www/"), true);
		}
		//System.out.println()

		JSONParser parse = new JSONParser();

		Object args = parms.getProperty("args","[]");
		Object sig = parms.getProperty("signature","[]");
		String calledMethod = (String)parms.getProperty("method");

		if(calledMethod == null) {
			JSONObject r = new JSONObject();
			r.put("result", "error");
			r.put("error", "Method doesn't exist!");
			info("[API Call] "+header.get("X-REMOTE-ADDR")+": Method doesn't exist.");
			return new NanoHTTPD.Response( HTTP_NOTFOUND, MIME_JSON, callback(callback, r.toJSONString()));
		}

		String key = parms.getProperty("key");

		if(!testLogin(calledMethod, key)) {
			JSONObject r = new JSONObject();
			r.put("result", "error");
			r.put("error", "Invalid API key.");
			info("[API Call] "+header.get("X-REMOTE-ADDR")+": Invalid API Key.");
			return new NanoHTTPD.Response(HTTP_FORBIDDEN, MIME_JSON, callback(callback, r.toJSONString()));
		}


		info("[API Call] "+header.get("X-REMOTE-ADDR")+": method="+ parms.getProperty("method").concat("?args=").concat((String) args));

		if(args == null || calledMethod == null) {
			JSONObject r = new JSONObject();
			r.put("result", "error");
			r.put("error", "You need to pass a method and an array of arguments.");
			return new NanoHTTPD.Response( HTTP_NOTFOUND, MIME_JSON, callback(callback, r.toJSONString()));
		}
		else {
			try {
				args = parse.parse((String) args);
				sig = parse.parse((String)sig);
			} catch (ParseException e) {
				e.printStackTrace();
			}
			if(args.getClass().getCanonicalName().endsWith("JSONArray")) {
				//for(Object x : (ArrayList)args) {
					try {
						Object result = callMethod(calledMethod,
								// TODO Make this suck less.
								// ick, this is why I hate Java. maybe I am just doing it wrong...
								(String[]) ((ArrayList) sig).toArray(new String[((ArrayList) sig).size()]),
								(Object[]) ((ArrayList) args).toArray(new Object[((ArrayList) args).size()]));
						/*if(result == null) {
							JSONObject r = new JSONObject();
							r.put("result", "error");
							r.put("error", "You need to pass a valid method and an array of arguments.");
							return new NanoHTTPD.Response( HTTP_NOTFOUND, MIME_JSON, callback(callback, r.toJSONString()));
						}*/
						JSONObject r = new JSONObject();
						r.put("result", "success");
						r.put("source", calledMethod);
						r.put("success", result);

						return new NanoHTTPD.Response( HTTP_OK, MIME_JSON, callback(callback, r.toJSONString()));
					}
					catch (Exception e) {
						JSONObject r = new JSONObject();
						r.put("result", "error");
						StringWriter pw = new StringWriter();
						e.printStackTrace(new PrintWriter( pw ));
						e.printStackTrace();
						r.put("error", "Caught exception: "+pw.toString());
						return new NanoHTTPD.Response( HTTP_INTERNALERROR, MIME_JSON, callback(callback, r.toJSONString()));
					}
				//}
			}
			JSONObject r = new JSONObject();
			r.put("result", "error");
			r.put("error", "You need to pass a method and an array of arguments.");
			return new NanoHTTPD.Response( HTTP_NOTFOUND, MIME_JSON, callback(callback, r.toJSONString()));
		}
	}
	
	public class Listener extends PluginListener {
	    public String join(String[] strings, String separator) {
	        StringBuffer sb = new StringBuffer();
	        for (int i=0; i < strings.length; i++) {
	            if (i != 0) sb.append(separator);
	      	    sb.append(strings[i]);
	      	}
	      	return sb.toString();
	    }

		public Listener() {
		}

		@Override
		public boolean onChat(Player player, String message) {
			HttpStream.log("chat", new String[]{player.getName(),message});

			return false;
		}

		@Override
		public void onDisconnect (Player player) {
			HttpStream.log("connections", new String[] {"disconnect", player.getName()});
		}

		@Override
		public void onLogin (Player player) {
			HttpStream.log("connections", new String[] {"connect", player.getName()});
		}

		@Override
		public boolean onCommand (Player player, String[] split) {
			HttpStream.log("commands", new String[] {player.getName(), join(split, " ")});

			return false;
		}
	}
}