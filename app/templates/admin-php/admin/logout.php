<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/auth.php';
nit_logout();
header('Location: login.php');
exit;
