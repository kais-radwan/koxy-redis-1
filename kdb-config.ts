const config: Config = {
  port: 6379,
  dbfilename: "dump.kdb",
  dir: "/tmp",
  collections: [
    {
      id: "people",
      schema: [
        { key: "first-name", type: "string", required: true },
        { key: "last-name", type: "string", required: true },
        { key: "age", type: "number", required: true, min: 18, max: 100 },
        { key: "email", type: "string", required: false },
        { key: "phone", type: "string", required: false },
        { key: "male", type: "boolean", required: false, default: true },
      ],
      index: ["first-name", "last-name"],
    },
  ],
};

export default config;
