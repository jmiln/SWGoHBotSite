module.exports = {
    apps: [
        {
            name: "website",
            interpreter: "node",
            script: "website.ts",
            watch: false,
            node_args: ["--env-file=.env", "--experimental-strip-types"],
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
