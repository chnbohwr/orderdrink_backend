var ipaddress, port;

if (process.env.OPENSHIFT_NODEJS_IP) {
    ipaddress = process.env.OPENSHIFT_NODEJS_IP;
    port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
} else {
    ipaddress = "127.0.0.1";
    port = 8080;
}