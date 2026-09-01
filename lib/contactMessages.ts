import { sql } from "./db";

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

function rowToMessage(row: any): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<ContactMessage> {
  const rows = await sql`
    INSERT INTO contact_messages (name, email, subject, message)
    VALUES (${input.name}, ${input.email}, ${input.subject}, ${input.message})
    RETURNING *
  `;
  return rowToMessage(rows[0]);
}
