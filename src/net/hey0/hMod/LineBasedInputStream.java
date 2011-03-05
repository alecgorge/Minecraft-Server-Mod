package net.hey0.hMod;

import java.io.InputStream;

/**
 * This class mimics the standard InputStream, except it pulls it's data from a string (ending in a newline) that is set using setText.
 *
 * @author Alec Gorge
 */
public class LineBasedInputStream extends InputStream {
	private byte[] nextLine;
	private boolean canRead = false;
	private int position = 0;
	private Object lineLock;

	/*public synchronized int available () {
		return nextLine.length;
	}*/

	/**
	 * Sets the string that is to be the source of input for the input stream. Can be called many times.
	 *
	 * @param txt The string to be the source for the input stream. Make sure it ends with a newline.
	 */
	public void setLine (String txt) {
		synchronized (lineLock) {
			position = 0;
			nextLine = txt.getBytes();
			canRead = true;
		}
	}

	public int read () {
		int i;

		while(!canRead) {}

		try {
			i = nextLine[position];
		}

		// we reached the end of the string!
		catch(Exception e) {
			i = -1;
			canRead = false;
			position = 0;
		}

		position++;

		return i;
	}

	public void close () {
		canRead = false;
		position = 0;
	}
}
