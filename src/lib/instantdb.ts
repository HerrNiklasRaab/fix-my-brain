import { init } from "@instantdb/react";

type Schema = {
  messages: {
    id: string;
    text: string;
    username: string;
    createdAt: number;
  };
};

const db = init<Schema>({ appId: "55b47b7d-15ce-4379-aa97-d2f947668041", devtool: false });

export default db;
