import qz from 'qz-tray';

export interface QZStatus {
  connected: boolean;
  connecting: boolean;
  version: string | null;
  printers: string[];
  error: string | null;
}

class QZTrayService {
  private status: QZStatus = {
    connected: false,
    connecting: false,
    version: null,
    printers: [],
    error: null,
  };

  private listeners: ((status: QZStatus) => void)[] = [];

  constructor() {
    // Optional auto-cert override for local dev/testing with QZ Tray
    try {
      qz.security.setCertificatePromise((resolve, reject) => {
        resolve("-----BEGIN CERTIFICATE-----\nMII... (Local QZ Certificate / Test)\n-----END CERTIFICATE-----");
      });
      qz.security.setSignatureAlgorithm("SHA512");
      qz.security.setSignaturePromise((toSign) => {
        return function(resolve, reject) {
          resolve(); // Allow local unsigned in dev/POS environment
        };
      });
    } catch (e) {
      console.warn("QZ Security cert config warning:", e);
    }
  }

  public subscribe(listener: (status: QZStatus) => void) {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.status });
    }
  }

  public async connect(): Promise<boolean> {
    if (this.status.connected) return true;
    if (this.status.connecting) return false;

    this.status.connecting = true;
    this.status.error = null;
    this.notify();

    // Try secure connection first (8182), then insecure (8181)
    const attempts = [
      { usessl: true, name: 'Secure (8182)' },
      { usessl: false, name: 'Insecure (8181)' }
    ];

    let lastError: any = null;

    for (const attempt of attempts) {
      try {
        if (qz.websocket.isActive()) {
          await qz.websocket.disconnect();
        }
        await qz.websocket.connect({ 
          retries: 1, 
          delay: 1, 
          usessl: attempt.usessl 
        });

        const version = await qz.api.getVersion();
        const printers = await qz.printers.list();

        this.status.connected = true;
        this.status.connecting = false;
        this.status.version = version;
        this.status.printers = printers || [];
        this.status.error = null;
        this.notify();
        console.log(`[QZ Tray] Connected successfully via ${attempt.name}, version: ${version}, printers:`, printers);
        return true;
      } catch (err: any) {
        console.warn(`[QZ Tray] Connection attempt via ${attempt.name} failed:`, err);
        lastError = err;
      }
    }

    // If both failed
    this.status.connected = false;
    this.status.connecting = false;
    this.status.error = lastError?.message || "تعذر الاتصال ببرنامج QZ Tray. تأكد من تشغيل البرنامج وقبول شهادة الأمان في المتصفح عبر زيارة https://localhost:8182";
    this.notify();
    return false;
  }

  public async disconnect(): Promise<void> {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch (e) {
      // ignore
    }
    this.status.connected = false;
    this.status.connecting = false;
    this.status.version = null;
    this.notify();
  }

  public getStatus(): QZStatus {
    return { ...this.status };
  }

  public async printData(printerName: string | null, data: string | any[], copies = 1, raw = true): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.status.connected) {
        const connected = await this.connect();
        if (!connected) {
          return { success: false, error: this.status.error || "QZ Tray غير متصل" };
        }
      }

      let targetPrinter = printerName;
      if (!targetPrinter || targetPrinter.trim() === "") {
        try {
          targetPrinter = await qz.printers.getDefault();
        } catch {
          targetPrinter = this.status.printers[0] || null;
        }
      }

      if (!targetPrinter) {
        return { success: false, error: "لا توجد طابعة محددة أو معرفة في النظام" };
      }

      const config = qz.configs.create(targetPrinter, {
        copies: copies || 1,
        encoding: 'UTF-8',
        altPrinting: true
      });

      const printData = Array.isArray(data) ? data : [data];
      await qz.print(config, printData);
      
      console.log(`[QZ Tray] Printed successfully to printer: ${targetPrinter}`);
      return { success: true };
    } catch (err: any) {
      console.error("[QZ Tray] Print error:", err);
      return { success: false, error: err.message || "خطأ أثناء إرسال أمر الطباعة عبر QZ Tray" };
    }
  }
}

export const qzService = new QZTrayService();
