// deno-lint-ignore-file no-explicit-any
import { stringify } from "https://deno.land/x/xml@2.0.4/mod.ts";

//#region Interfaces
export interface Payment {
  /** Max length is 35 */
  id: string;
  name: string;
  iban: string;
  bic: string;
  mandateId?: string;
  mandateSignatureDate?: Date;

  amount: number;
  /** Default is "EUR" */
  currency?: string;
  remittanceInformation: string;
  end2endReference?: string;
}

export interface CreditorPayments {
  /** Max length is 35 */
  id: string;
  batchBooking?: boolean;
  /** When the payment should be executed */
  requestedExecutionDate: Date;
  collectionDate?: Date;

  name: string;
  iban: string;
  bic: string;

  payments: Payment[];
}

export interface SepaData {
  painVersion?: PAIN_VERSIONS;
  xmlVersion?: string;
  xmlEncoding?: string;
  xsiNamespace?: string;
  xsiXmls?: string;

  localInstrumentation?: LOCAL_INSTRUMENTATION;
  sequenceType?: SEQUENCE_TYPE;
  batchBooking?: boolean;

  /** Max length is 35 */
  id: string;
  creationDate: Date;
  /** Max length is 70 */
  initiatorName: string;

  positions: CreditorPayments[];
}
//#endregion

//#region enum | type
enum PAIN_TYPES {
  "pain.001.001.02" = "pain.001.001.02",
  "pain.001.003.02" = "pain.001.003.02",
  "pain.001.001.03" = "CstmrCdtTrfInitn",
  "pain.001.003.03" = "CstmrCdtTrfInitn",
  "pain.008.001.01" = "pain.008.001.01",
  "pain.008.003.01" = "pain.008.003.01",
  "pain.008.001.02" = "CstmrDrctDbtInitn",
  "pain.008.003.02" = "CstmrDrctDbtInitn",
}

export type PAIN_VERSIONS =
  | "pain.001.001.02"
  | "pain.001.003.02"
  | "pain.001.001.03"
  | "pain.001.003.03"
  | "pain.008.001.01"
  | "pain.008.003.01"
  | "pain.008.001.02"
  | "pain.008.003.02";

export type LOCAL_INSTRUMENTATION = "CORE" | "COR1" | "B2B";
export type SEQUENCE_TYPE = "FRST" | "RCUR" | "OOFF" | "FNAL";
//#endregion

//#region const
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const XSI_XMLS = "urn:iso:std:iso:20022:tech:xsd:";
const PAIN_VERSION = "pain.001.001.03";
const XML_VERSION = "1.0";
const XML_ENCODING = "UTF-8";
//#endregion

/**
 * Generate a SEPA XML file
 *
 * If the length of the values is longer than the max length, it will throw an error
 * or if checkIBAN or checkBIC is true, it will check if the IBAN or BIC is valid and throw an error if it is not
 */
export function generateSepaXML(
  sepaData: SepaData,
): { result: string } | { error: string } {
  try {
    const painFormat = sepaData.painVersion ?? PAIN_VERSION;
    const painVersion =
      parseInt(
        painFormat.substring(painFormat.length, painFormat.length - 2),
        10,
      ) + (painFormat.indexOf("pain.008") === 0 ? 1 : 0);

    const declaration = {
      "@version": sepaData.xmlVersion ?? XML_VERSION,
      "@encoding": sepaData.xmlEncoding ?? XML_ENCODING,
    };

    checkLength(sepaData.id, "sepaData.id", 35);
    checkLength(sepaData.initiatorName, "sepaData.initiatorName", 70);

    const Document: {
      "@xmlns": string;
      "@xmlns:xsi": string;
      "@xsi:schemaLocation": string;
      [key: string]: any;
    } = {
      "@xmlns": `${sepaData.xsiXmls ?? XSI_XMLS}${painFormat}`,
      "@xmlns:xsi": sepaData.xsiNamespace ?? XSI_NAMESPACE,
      "@xsi:schemaLocation": `${
        sepaData.xsiXmls ?? XSI_XMLS
      }${painFormat} ${painFormat}.xsd`,
    };

    Document[PAIN_TYPES[painFormat]] = {
      GrpHdr: {
        MsgId: sepaData.id,
        CreDtTm: sepaData.creationDate.toISOString().substring(0, 19),
        NbOfTxs: sepaData.positions.reduce(
          (sum, item) => sum + item.payments.length,
          0,
        ),
        CtrlSum: sepaData.positions
          .reduce(
            (sum, item) =>
              sum +
              item.payments.reduce((sum, payment) => sum + payment.amount, 0),
            0,
          )
          .toFixed(2),
        InitgPty: {
          Nm: sepaData.initiatorName,
        },
      },
      PmtInf: getPmtInf(sepaData, painFormat, painVersion),
    };

    if (painVersion === 2) {
      Document[PAIN_TYPES[painFormat]].GrpHdr.BtchBookg = (
        sepaData.batchBooking ?? false
      ).toString();
      Document[PAIN_TYPES[painFormat]].GrpHdr.Grpg = "MIXD";
    }

    return {
      result: stringify({
        xml: declaration,
        Document: Document,
      }),
    };
  } catch (error) {
    return { error: error.message };
  }
}

function getPmtInf(
  sepaData: SepaData,
  painFormat: PAIN_VERSIONS,
  painVersion: number,
) {
  return sepaData.positions.map((item, index) => {
    checkLength(item.id, `sepaData.positions[${index}].id`, 35);
    checkLength(item.name, `sepaData.positions[${index}].name`, 70);

    const pmtMtd = painFormat.indexOf("pain.001") === 0 ? "TRF" : "DD";
    const pmtInfData: { [key: string]: any } = {
      PmtInfId: item.id,
      PmtMtd: pmtMtd,
      PmtTpInf: { SvcLvl: { Cd: "SEPA" } },
      ChrgBr: "SLEV",
    };

    if (painVersion === 3) {
      pmtInfData.BtchBookg = (item.batchBooking ?? false).toString();
      pmtInfData.NbOfTxs = item.payments.length;
      pmtInfData.CtrlSum = item.payments
        .reduce((sum, payment) => sum + payment.amount, 0)
        .toFixed(2);
    }

    if (pmtMtd === "DD") {
      pmtInfData.PmtTpInf.LclInstrm = {
        Cd: sepaData.localInstrumentation ?? "",
      };
      pmtInfData.SeqTp = sepaData.sequenceType ?? undefined;
      pmtInfData.ReqdColltnDt = item.collectionDate
        ?.toISOString()
        .substring(0, 10);

      pmtInfData.Cdtr = {
        Nm: item.name,
      };
      pmtInfData.CdtrAcct = {
        Id: {
          IBAN: item.iban,
        },
      };
      pmtInfData.CdtrAgt = { FinInstnId: { BIC: item.bic } };
      pmtInfData.CdtrSchmeId = {
        Id: {
          PrvtId: {
            Othr: {
              Id: item.id ?? "",
              SchmeNm: {
                Prtry: "SEPA",
              },
            },
          },
        },
      };
    } else {
      pmtInfData.ReqdExctnDt = item.requestedExecutionDate
        .toISOString()
        .substring(0, 10);

      pmtInfData.Dbtr = {
        Nm: item.name,
      };
      pmtInfData.DbtrAcct = {
        Id: {
          IBAN: item.iban,
        },
      };
      pmtInfData.DbtrAgt = { FinInstnId: { BIC: item.bic } };
    }

    pmtInfData.CdtTrfTxInf = getPayments(item.payments, index, pmtMtd);

    return pmtInfData;
  });
}

function getPayments(payments: Payment[], index: number, pmtMtd: "TRF" | "DD") {
  return payments.map((payment, paymentIndex) => {
    checkLength(
      payment.id,
      `sepaData.positions[${index}].payments[${paymentIndex}].id`,
      35,
    );
    checkLength(
      payment.name,
      `sepaData.positions[${index}].payments[${paymentIndex}].name`,
      35,
    );

    const paymentData: { [key: string]: any } = {
      PmtId: {
        InstrId: payment.id,
      },
      RmtInf: { Ustrd: payment.remittanceInformation },
    };

    if (payment.end2endReference) {
      paymentData.PmtId.EndToEndId = payment.end2endReference;
    }

    if (pmtMtd === "DD") {
      paymentData.Amt = {
        "@Ccy": payment.currency || "EUR",
        InstdAmt: payment.amount.toFixed(2),
      };

      paymentData.DrctDbtTx = {
        MndtRltdInf: {
          MndtId: payment.mandateId ?? "",
          DtOfSgntr:
            payment.mandateSignatureDate?.toISOString().substring(0, 10) ?? "",
        },
      };

      paymentData.DbtrAcct = {
        Id: {
          IBAN: payment.iban,
        },
      };
      paymentData.DbtrAgt = {
        FinInstnId: { BIC: payment.bic },
      };
      paymentData.Dbtr = { Nm: payment.name };
    } else {
      paymentData.Amt = {
        InstdAmt: {
          "@Ccy": payment.currency || "EUR",
          "#text": payment.amount.toFixed(2),
        },
      };

      paymentData.CdtrAcct = {
        Id: {
          IBAN: payment.iban,
        },
      };
      paymentData.CdtrAgt = {
        FinInstnId: { BIC: payment.bic },
      };
      paymentData.Cdtr = { Nm: payment.name };
    }

    return paymentData;
  });
}

function checkLength(value: string, name: string, length: number) {
  if (value.length > length) {
    throw new Error(`Max length for ${name} is ${length} (${value})`);
  }
}
