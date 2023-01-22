import { generateSepaXML } from "./mod.ts";

Deno.bench("Create valid xml", () => {
  generateSepaXML({
    painVersion: "pain.001.001.02",
    id: "1",
    creationDate: new Date(2022, 5, 16, 0, 0),
    initiatorName: "Test",
    positions: [
      {
        name: "Test",
        iban: "DE02701500000000594937",
        bic: "SSKMDEMM",
        requestedExecutionDate: new Date(2022, 5, 16, 0, 0),
        id: "123",
        payments: [
          {
            id: "Payment 1 ",
            amount: 123,
            iban: "DE02701500000000594937",
            bic: "SSKMDEMM",
            name: "Test",
            remittanceInformation: "WOW 1",
          },
          {
            id: "Payment 2",
            amount: 123.83,
            iban: "DE02701500000000594937",
            bic: "SSKMDEMM",
            name: "Test",
            remittanceInformation: "WOW 2",
          },
          {
            id: "Payment 3",
            amount: 69,
            iban: "DE02701500000000594937",
            bic: "SSKMDEMM",
            name: "Test",
            remittanceInformation: "WOW 3",
          },
        ],
      },
    ],
  });
});

Deno.bench("Create xml with an error", () => {
  generateSepaXML({
    painVersion: "pain.001.001.02",
    id: "1",
    creationDate: new Date(2022, 5, 16, 0, 0),
    initiatorName: "Test",
    positions: [
      {
        name: "Test",
        iban: "DE02701500000000594937",
        bic: "SSKMDEMM",
        requestedExecutionDate: new Date(2022, 5, 16, 0, 0),
        id: "123",
        payments: [
          {
            id: "111111111111111111111111111111111111",
            amount: 123,
            iban: "DE02701500000000594937",
            bic: "SSKMDEMM",
            name: "Test",
            remittanceInformation: "WOW 1",
          },
        ],
      },
    ],
  });
});
