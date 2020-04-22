const express = require("express");
const exphbs = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const env = require("./env");
const mysql = require("mysql");
// create connection object for the database
const db = mysql.createConnection({
  host: env.msHost,
  user: env.msUser,
  password: env.msPassword,
  database: env.msDatabase,
});

// connect to database
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to database");

  //Create table to save user details
  var createTableQuery =
    "CREATE TABLE IF NOT EXISTS login(" +
    "email VARCHAR (100) PRIMARY KEY," +
    "firstName VARCHAR (50) NOT NULL," +
    "lastName VARCHAR (50) NOT NULL," +
    "password VARCHAR (100) NOT NULL)";

  db.query(createTableQuery, (err, result) => {
    if (err) throw err;
    console.log("Table created");
  });
});

//Utility method to create hashed password
const getHashedPassword = (password) => {
  const sha256 = crypto.createHash("sha256");
  const hash = sha256.update(password).digest("base64");
  return hash;
};

// setup required parsers and engine for the server
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.engine(
  "hbs",
  exphbs({
    extname: ".hbs",
  })
);
app.set("view engine", "hbs");

//Open homepage
app.get("/", (req, res) => {
  res.render("home");
});

//Click on login button
app.get("/login", (req, res) => {
  res.render("login");
});

//Click submit button for login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);

  var findUserQuery = "SELECT * from login where email=? AND password=?";

  db.query(findUserQuery, [email, hashedPassword], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      const user = results[0];
      res.cookie("AuthUser", user.firstName + " " + user.lastName);
      res.redirect("/profile");
      return;
    } else {
      res.render("login", {
        message: "Invalid username or password",
        messageClass: "alert-danger",
      });
    }
  });
});

//Clicl on register button
app.get("/register", (req, res) => {
  res.render("register");
});

//Click submit button for register
app.post("/register", async (req, res) => {
  const { email, firstName, lastName, password, confirmPassword } = req.body;

  if (password === confirmPassword) {
    //Check if a user with same email exists in DB
    var findUserQuery = "SELECT * from login where email=?";
    db.query(findUserQuery, [email], (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        res.render("register", {
          message: "User already registered.",
          messageClass: "alert-danger",
        });
        return;
      } else {
        //Create hashed password and save the user data to DB
        const hashedPassword = getHashedPassword(password);
        var insertUserQuery =
          "INSERT INTO login(email, firstName, lastName, password) VALUES (?,?,?,?)";
        db.query(
          insertUserQuery,
          [email, firstName, lastName, hashedPassword],
          (err, result) => {
            if (err) throw err;
            res.render("login", {
              message: "Registration Complete. Please login to continue.",
              messageClass: "alert-success",
            });
          }
        );
      }
    });
  } else {
    res.render("register", {
      message: "Password does not match.",
      messageClass: "alert-danger",
    });
  }
});

// Read  auth user details cookie before redirection to profile
app.use((req, res, next) => {
  req.user = req.cookies["AuthUser"];
  next();
});

//User redirected after succesful login
app.get("/profile", (req, res) => {
  if (req.user) {
    res.render("profile", {
      message: "Welcome " + req.user,
      messageClass: "alert-info",
    });
  } else {
    res.render("login", {
      message: "Please login to continue",
      messageClass: "alert-danger",
    });
  }
});

//Clear cookie when logged out and redirect to homepage
app.get("/logout", (req, res) => {
  if (req.user) {
    res.clearCookie("AuthUser");
    res.render("login", {
      message: "Succesfully logged out",
      messageClass: "alert-danger",
    });
  } else {
    res.render("home");
  }
});

//Start the server on the specified port
app.listen(env.serverPort, () => {
  console.log("LoginApp started on port " + env.serverPort);
});