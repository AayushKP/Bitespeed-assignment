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

    res.status(200).json({ contacts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
