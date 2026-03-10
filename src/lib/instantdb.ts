import { init, i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    messages: i.entity({
      text: i.string(),
      username: i.string(),
      createdAt: i.number(),
    }),
  },
});

const db = init({ appId: "55b47b7d-15ce-4379-aa97-d2f947668041", devtool: false, schema });

export default db;
