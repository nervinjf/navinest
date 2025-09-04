const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");

const Users = db.define('users', {

    id:{
        type:DataTypes.INTEGER,
        primaryKey:true,
        autoIncrement: true,
        allowNull:false,
    },
    nombre:{
        type:DataTypes.STRING(250),
        allowNull: false,
    },
    apellido:{
        type:DataTypes.STRING(250),
        allowNull: false,
    },
    correo:{
        type:DataTypes.STRING,
        allowNull: false,
        validate:{
            isEmail:true,
        },
    },
    password:{
        type:DataTypes.STRING(100),
        allowNull: false,
    },
    telefono:{
        type:DataTypes.STRING(20),
        allowNull: true,
    },
    tipoCedula:{
        type:DataTypes.STRING(5),
        allowNull: true,
    },
    cedula:{
        type:DataTypes.STRING(15),
        allowNull: true,
    },
    rol: {
        type: DataTypes.STRING(25), // Longitud del OTP
        allowNull: true, // Permitir que el campo sea nulo mientras se espera el OTP
    },
    active: {
        type: DataTypes.BOOLEAN, // Longitud del OTP
        defaultValue: true
    }
},{
    hooks:{
        beforeCreate: (user, options) =>{
            const { password } = user;
            const hash = bcrypt.hashSync(password, 8);
            user.password = hash;
        },
    },
});

module.exports = Users;