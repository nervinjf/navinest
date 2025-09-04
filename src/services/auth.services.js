const { Users } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

class AuthServices {
  static async authenticate(credentials) {
    try {
      const { correo, password } = credentials;
      const result = await Users.findOne({
        where: { correo },
      });
      if (result) {
        const isValid = bcrypt.compareSync(password, result.password);
        return isValid ? { isValid, result } : isValid;
      } else {
        console.log("resultado es", result)
        return result;
      }
    } catch (error) {
      throw error;
    }
  }

  static genToken(data) {
    try {
      const token = jwt.sign(data, process.env.SECRET, {
        expiresIn: '8h',
        algorithm: "HS512",
      });
      return token;
    } catch (error) {
      throw error;
    }
  }

  static async resetpass(newPassword, userId) {
    try {
        console.log(newPassword, userId)
       // Hashear la nueva contraseña
       const hashedPassword = await bcrypt.hash(newPassword, 8);

       // Actualizar la contraseña en la base de datos
      const restar =  await Users.update({ password: hashedPassword }, { where: { id: userId } });


      return restar;
    } catch (error) {
      throw error;
    }
  }

  static async validatetoken(token) {
    try {
      
      const decoded = jwt.verify(token, process.env.SECRET);
      
      console.log( "hola", decoded)

      const userId = decoded; // Devuelve el ID de usuario si el token es válido

      return userId;

    } catch (error) {
      throw error;
    }
  }


  static async forgot(email) {
    try {

      const user = await Users.findOne({ 
        where: {correo: email.correo} 
      });
      
      const { nombre, correo, id, rol } = user;
      const userdata = { nombre, correo, id, rol};

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      const resetpass = jwt.sign(userdata, process.env.SECRET, {
        expiresIn: '10min',
        algorithm: "HS512",
      });
      
    const resetLink = `http://localhost:5173/#/resetpassword/${resetpass}`;

    return {correo: user.correo, link: resetLink, nombre: user.nombre, apellido: user.apellido};

    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthServices;

// email --> tengo que obtener al usuario de la base de datos
//
