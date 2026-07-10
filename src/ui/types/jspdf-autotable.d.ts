declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  export default function (doc: jsPDF, options?: any): void;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable?: (options: any) => void;
  }
}
