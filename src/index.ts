import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient, Contact } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("Server running !");
});

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    let { phoneNumber } = req.body;
    phoneNumber = phoneNumber ? phoneNumber.toString() : null;

    if (!email && !phoneNumber) {
      res
        .status(400)
        .json({ Error: "either email or phone number is required" });
      return;
    }

    const contacts: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          { email: email || undefined },
          { phoneNumber: phoneNumber || undefined },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    let primaryContact: Contact;
    let secondaryContactIds: number[] = [];
    const emailsSet = new Set<string>();
    const phoneNumbersSet = new Set<string>();

    if (contacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: "primary",
        },
      });
      primaryContact = newContact;
      if (newContact.email) {
        emailsSet.add(newContact.email);
      }
      if (newContact.phoneNumber) {
        phoneNumbersSet.add(newContact.phoneNumber);
      }
    } else {
      primaryContact =
        contacts.find((contact) => contact.linkPrecedence === "primary") ||
        contacts[0];

      contacts.forEach((contact) => {
        if (contact.email) {
          emailsSet.add(contact.email);
        }
        if (contact.phoneNumber) {
          phoneNumbersSet.add(contact.phoneNumber);
        }
      });

      secondaryContactIds = contacts
        .filter((contact) => contact.linkPrecedence === "secondary")
        .map((contact) => contact.id);

      let needToCreateSecondary = false;
      if (email && !emailsSet.has(email)) {
        needToCreateSecondary = true;
      }
      if (phoneNumber && !phoneNumbersSet.has(phoneNumber)) {
        needToCreateSecondary = true;
      }

      if (needToCreateSecondary) {
        const newSecondary = await prisma.contact.create({
          data: {
            email: email || null,
            phoneNumber: phoneNumber || null,
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          },
        });
        secondaryContactIds.push(newSecondary.id);
        if (newSecondary.email) {
          emailsSet.add(newSecondary.email);
        }
        if (newSecondary.phoneNumber) {
          phoneNumbersSet.add(newSecondary.phoneNumber);
        }
      }
    }

    const responseContact = {
      primaryContatctId: primaryContact.id,
      emails: Array.from(emailsSet),
      phoneNumbers: Array.from(phoneNumbersSet),
      secondaryContactIds: secondaryContactIds,
    };

    res.status(200).json({ contact: responseContact });
  } catch (error) {
    console.error("Error in /identify endpoint:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
