package net.hey0.hMod;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;

/**
 * Every time data is received on the PipedInputSteam pi, it is written to the JTextArea textarea.
 *
 * @author Alec Gorge
 */
public class InputStreamReaderThread implements Runnable {
	PipedInputStream pi;
	PrintStream p;
	PipedOutputStream o;
	List<Handler> handlers = new ArrayList<Handler>();

	public InputStreamReaderThread(PipedInputStream pi, PipedOutputStream o, PrintStream s) {
		this.pi = pi;
		p = s;
		this.o = o;
	}

	public void start () {
		(new Thread(this)).start();
	}

	public void addHander (Handler h) {
		handlers.add(h);
	}

	public void run() {
		final byte[] buf = new byte[4096];
		try {
			while (true) {
				final int len = pi.read(buf);
				if (len == -1) {
					break;
				}

				String str = new String(buf, 0, len);
				p.print(str);
				//p.write(buf);
				for(Handler h : handlers) {
					h.publish(new LogRecord(Level.INFO, str));
				}

				try {
					Thread.sleep(100);
				}
				catch (InterruptedException e) {
					e.printStackTrace();
				}
			}
		} catch (IOException e) {
		}
	}
}
