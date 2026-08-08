import { useState, useEffect } from 'react';
import { qzService, QZStatus } from '../lib/qzTrayService';

export function useQZTray() {
  const [status, setStatus] = useState<QZStatus>(qzService.getStatus());

  useEffect(() => {
    const unsubscribe = qzService.subscribe((newStatus: QZStatus) => {
      setStatus(newStatus);
    });

    // Auto connect attempt on mount
    if (!status.connected && !status.connecting) {
      qzService.connect();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const connect = () => qzService.connect();
  const disconnect = () => qzService.disconnect();
  const printData = (printerName: string | null, data: string | any[], copies = 1, raw = true) => 
    qzService.printData(printerName, data, copies, raw);

  return {
    ...status,
    connect,
    disconnect,
    printData,
  };
}
