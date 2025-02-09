"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)({
    origin: process.env.ORIGIN || "http://localhost:5173",
    credentials: true,
}));
const port = process.env.PORT || 3000;
//For Quick Testing
app.get("/", (req, res) => {
    res.send("Server running !");
});
app.post("/identify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const contacts = yield prisma.contact.findMany({
            where: {
                OR: [
                    { email: email || undefined },
                    { phoneNumber: phoneNumber || undefined },
                ],
            },
            orderBy: { createdAt: "asc" },
        });
        let primaryContact;
        let secondaryContactIds = [];
        const emailsSet = new Set();
        const phoneNumbersSet = new Set();
        if (contacts.length === 0) {
            const newContact = yield prisma.contact.create({
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
        }
        else {
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
                const newSecondary = yield prisma.contact.create({
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
    }
    catch (error) {
        console.error("Error in /identify endpoint:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
