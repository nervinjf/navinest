const linkReset = (link, nombre, apellido) => `
<!DOCTYPE html>
<html lang="en" xmlns="https://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title></title>
  <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
  <style>
    table,
    td,
    div,
    h1,
    p {
      font-family: SF Pro Display, sans-serif;
    }
  </style>
</head>

<body style="padding: 0; margin: 0; width: 100%">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tbody><tr border="0">
	            <td>
	                <table border="0" cellpadding="0" cellspacing="0" width="100%">
	                    <tbody><tr>
		                    <td>
		                        <a href="http://www.nebconnection.com/" style="display:inline-block" target="_blank" data-saferedirecturl="https://www.google.com/url?q=http://www.nebconnection.com/&amp;source=gmail&amp;ust=1708547890441000&amp;usg=AOvVaw2nucf5mlJO3XH76HdT_9E_"><img src="/img/NC_VersionPPAL_RGB.png" style="display:block;height:30px;width:80px" data-image-whitelisted="" class="CToWUd" data-bit="iit"></a>
		                    </td>
	                    </tr>
	                    <tr>
		                    <td style="padding:20px 0 0 0;font-size:24px;line-height:48px;font-family:'Open Sans','Trebuchet MS',sans-serif">
		                    	<b><a href="#m_2314475592049422884_" rel="nofollow" style="text-decoration:none!important;color:#222!important">Hola, ${nombre} ${apellido} !</a></b>
		                    </td>
	                    </tr>
	                    <tr>
		                    <td style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">
Utilice el siguiente Link para restablecer la contraseña en su cuenta de nebconnection.<br>Este <span class="il">Link</span> será válida durante 10 minutos </td>
	                    </tr>
	                    <tr>
		                    <td style="padding:20px 0 0 0;font-size:15px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">
		                        <b>${link}</b>
		                    </td>
	                    </tr>
	                    <tr>
		                    <td style="padding:20px 0 0 0;font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">
Saludos,<br>		                    </td>
	                    </tr>
	                    <tr>
		                    <td style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">
		                        <b>El equipo de nebconnection</b><br>
		                    </td>
	                    </tr>
	                     <tr>
		                    <td style="font-size:14px;line-height:24px;font-family:'Open Sans','Trebuchet MS',sans-serif">
		                        <a href="http://www.nebconnection.com/" style="color:#2696eb;text-decoration:none" target="_blank" data-saferedirecturl="https://www.google.com/url?q=http://www.nebconnection.com/&amp;source=gmail&amp;ust=1708547890441000&amp;usg=AOvVaw2nucf5mlJO3XH76HdT_9E_">www.nebconnection.com</a> 
		                    </td>
	                    </tr>
	                </tbody></table>
	            </td>
            </tr>           
        </tbody></table>
        </body>
</html>
`

module.exports = linkReset;