from flask import Flask, send_from_directory

app = Flask(__name__)

@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def files(filename):
    return send_from_directory(".", filename)

if __name__ == "__main__":
    app.run(debug=True)
